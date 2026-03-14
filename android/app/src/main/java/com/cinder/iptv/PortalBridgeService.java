package com.cinder.iptv;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class PortalBridgeService {
    private static final String MAG_USER_AGENT = "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250";
    private static final String[] CONTEXT_PATHS = {"", "stalker_portal", "c"};
    private static final String[] ENDPOINT_FILES = {"server/load.php", "portal.php"};
    private static final long SESSION_TTL_MS = 4L * 60L * 1000L;
    private static final String DEFAULT_STB_TYPE = "MAG250";
    private static final String DEFAULT_IMAGE_VERSION = "218";
    private static final String DEFAULT_HW_VERSION = "1.7-BD-00";
    private static final String DEFAULT_PORTAL_VERSION = "5.6.0";
    private static final String DEFAULT_API_SIGNATURE = "262";
    private static final Pattern MAC_PATTERN = Pattern.compile("^([0-9A-F]{2}:){5}[0-9A-F]{2}$");
    private static final Pattern SEASON_PATTERN = Pattern.compile("(\\d{1,2})");
    private static final Map<String, CachedSession> SESSION_CACHE = new ConcurrentHashMap<>();

    public JSArray fetchPortalPlaylist(String portalUrl, String macAddress) throws Exception {
        PortalSession session = createPortalSession(portalUrl, macAddress);
        JSArray entries = new JSArray();

        appendAll(entries, fetchMovieEntries(session));
        appendAll(entries, fetchSeriesEpisodeEntries(session));
        appendAll(entries, fetchLiveEntries(session));

        return entries;
    }

    public void testPortalConnection(String portalUrl, String macAddress) throws Exception {
        createPortalSession(portalUrl, macAddress);
    }

    public String resolvePortalStreamUrl(
        String portalUrl,
        String macAddress,
        String portalType,
        String portalCommand,
        Integer portalEpisode
    ) throws Exception {
        PortalSession session = createPortalSession(portalUrl, macAddress);
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        params.put("type", portalType);
        params.put("action", "create_link");
        params.put("cmd", portalCommand);
        params.put("series", portalEpisode == null ? "" : String.valueOf(portalEpisode));
        params.put("forced_storage", "undefined");
        params.put("disable_ad", "0");
        params.put("download", "0");
        params.put("JsHttpRequest", "1-xml");

        JSONObject payload = fetchPortalJson(session, "?" + buildQuery(params), false);
        JSONObject js = payload.optJSONObject("js");
        String command = js == null ? "" : js.optString("cmd", "");
        if (command.isEmpty()) {
            throw new IOException("The portal did not return a playable stream URL.");
        }

        String normalized = command.replaceFirst("(?i)^ffmpeg\\s+", "").trim();
        Matcher matcher = Pattern.compile("(https?://.+)$").matcher(command);
        if (matcher.find()) {
            normalized = matcher.group(1);
        }

        if (normalized.isEmpty()) {
            throw new IOException("The portal returned an invalid playback command.");
        }

        return normalized;
    }

    private JSArray fetchLiveEntries(PortalSession session) throws Exception {
        JSONObject genresPayload = fetchPortalJson(session, "?type=itv&action=get_genres&JsHttpRequest=1-xml", false);
        JSONObject channelsPayload = fetchPortalJson(session, "?type=itv&action=get_all_channels&JsHttpRequest=1-xml", false);

        Map<String, String> genres = new LinkedHashMap<>();
        JSONArray genreArray = genresPayload.optJSONArray("js");
        if (genreArray != null) {
            for (int index = 0; index < genreArray.length(); index += 1) {
                JSONObject genre = genreArray.optJSONObject(index);
                if (genre != null) {
                    genres.put(String.valueOf(genre.opt("id")), genre.optString("title", "Live"));
                }
            }
        }

        JSONArray entries = new JSONArray();
        JSONObject channelsJs = channelsPayload.optJSONObject("js");
        JSONArray channels = channelsJs == null ? null : channelsJs.optJSONArray("data");
        if (channels == null) {
            return toJsArray(entries);
        }

        for (int index = 0; index < channels.length(); index += 1) {
            JSONObject channel = channels.optJSONObject(index);
            if (channel == null) {
                continue;
            }

            entries.put(buildPortalEntry(
                "live-" + channel.optString("id"),
                channel.optString("name"),
                genres.getOrDefault(String.valueOf(channel.opt("tv_genre_id")), "Live"),
                channel.optString("logo", null),
                "itv",
                channel.optString("cmd", ""),
                "channel",
                null,
                String.valueOf(channel.opt("id"))
            ));
        }

        return toJsArray(entries);
    }

    private JSArray fetchMovieEntries(PortalSession session) throws Exception {
        JSONObject categoriesPayload = fetchPortalJson(session, "?type=vod&action=get_categories&JsHttpRequest=1-xml", false);
        JSONArray categories = categoriesPayload.optJSONArray("js");
        JSONArray entries = new JSONArray();
        if (categories == null) {
            return toJsArray(entries);
        }

        for (int categoryIndex = 0; categoryIndex < categories.length(); categoryIndex += 1) {
            JSONObject category = categories.optJSONObject(categoryIndex);
            if (category == null) {
                continue;
            }

            Map<String, String> params = new LinkedHashMap<>();
            params.put("genre", String.valueOf(category.opt("id")));
            params.put("sortby", "added");
            JSONArray videos = fetchPagedPrograms(session, "vod", params);
            for (int videoIndex = 0; videoIndex < videos.length(); videoIndex += 1) {
                JSONObject video = videos.optJSONObject(videoIndex);
                if (video == null) {
                    continue;
                }

                entries.put(buildPortalEntry(
                    "movie-" + video.optString("id"),
                    video.optString("name"),
                    category.optString("title", "Movies"),
                    video.optString("screenshot_uri", null),
                    "vod",
                    video.optString("cmd", ""),
                    "movie",
                    null,
                    null
                ));
            }
        }

        return toJsArray(entries);
    }

    private JSArray fetchSeriesEpisodeEntries(PortalSession session) throws Exception {
        JSONObject categoriesPayload = fetchPortalJson(session, "?type=series&action=get_categories&JsHttpRequest=1-xml", false);
        JSONArray categories = categoriesPayload.optJSONArray("js");
        JSONArray entries = new JSONArray();
        if (categories == null) {
            return toJsArray(entries);
        }

        for (int categoryIndex = 0; categoryIndex < categories.length(); categoryIndex += 1) {
            JSONObject category = categories.optJSONObject(categoryIndex);
            if (category == null) {
                continue;
            }

            Map<String, String> listParams = new LinkedHashMap<>();
            listParams.put("category", String.valueOf(category.opt("id")));
            listParams.put("sortby", "added");
            JSONArray seriesList = fetchPagedPrograms(session, "series", listParams);
            for (int seriesIndex = 0; seriesIndex < seriesList.length(); seriesIndex += 1) {
                JSONObject series = seriesList.optJSONObject(seriesIndex);
                if (series == null) {
                    continue;
                }

                Map<String, String> seasonParams = new LinkedHashMap<>();
                seasonParams.put("movie_id", urlEncode(series.optString("id", "")));
                seasonParams.put("sortby", "added");
                JSONArray seasons = fetchPagedPrograms(session, "series", seasonParams);
                for (int seasonIndex = 0; seasonIndex < seasons.length(); seasonIndex += 1) {
                    JSONObject season = seasons.optJSONObject(seasonIndex);
                    if (season == null) {
                        continue;
                    }

                    int seasonNumber = parseSeasonNumber(season.optString("name", ""), seasonIndex + 1);
                    JSONArray episodeNumbers = season.optJSONArray("series");
                    if (episodeNumbers == null) {
                        continue;
                    }

                    for (int episodeIndex = 0; episodeIndex < episodeNumbers.length(); episodeIndex += 1) {
                        int episodeNumber = episodeNumbers.optInt(episodeIndex);
                        String title = String.format(
                            Locale.US,
                            "%s S%02dE%02d",
                            series.optString("name", "Series"),
                            seasonNumber,
                            episodeNumber
                        );

                        entries.put(buildPortalEntry(
                            "series-" + series.optString("id") + "-" + seasonNumber + "-" + episodeNumber,
                            title,
                            category.optString("title", "Series"),
                            firstNonBlank(season.optString("screenshot_uri", null), series.optString("screenshot_uri", null)),
                            "vod",
                            season.optString("cmd", ""),
                            "series",
                            episodeNumber,
                            null
                        ));
                    }
                }
            }
        }

        return toJsArray(entries);
    }

    private JSONArray fetchPagedPrograms(PortalSession session, String type, Map<String, String> extraParams) throws Exception {
        JSONArray results = new JSONArray();
        int page = 1;

        while (true) {
            LinkedHashMap<String, String> params = new LinkedHashMap<>();
            params.put("type", type);
            params.put("action", "get_ordered_list");
            params.put("p", String.valueOf(page));
            params.put("JsHttpRequest", "1-xml");
            params.putAll(extraParams);

            JSONObject payload = fetchPortalJson(session, "?" + buildQuery(params), true);
            JSONObject js = payload.optJSONObject("js");
            JSONArray data = js == null ? null : js.optJSONArray("data");
            if (data == null || data.length() == 0) {
                break;
            }

            for (int index = 0; index < data.length(); index += 1) {
                results.put(data.opt(index));
            }

            int total = js.optInt("total_items", 0);
            int perPage = js.optInt("max_page_items", data.length());
            if (total > 0 && perPage > 0 && results.length() >= total) {
                break;
            }

            page += 1;
            if (page > 40) {
                break;
            }
        }

        return results;
    }

    private PortalSession createPortalSession(String portalUrl, String macAddress) throws Exception {
        String cacheKey = (portalUrl + "|" + macAddress).toLowerCase(Locale.US);
        CachedSession cached = SESSION_CACHE.get(cacheKey);
        if (cached != null && cached.expiresAt > System.currentTimeMillis()) {
            return cached.session;
        }

        String endpoint = resolvePortalEndpoint(portalUrl, macAddress);
        DeviceProfile profile = buildPortalDeviceProfile(macAddress);

        LinkedHashMap<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "application/json");
        headers.put("User-Agent", MAG_USER_AGENT);
        headers.put("X-User-Agent", MAG_USER_AGENT);
        headers.put("Cookie", profile.cookies);
        headers.put("SN", profile.serialNumber);
        headers.put("Referer", endpoint);

        LinkedHashMap<String, String> handshakeParams = new LinkedHashMap<>();
        handshakeParams.put("type", "stb");
        handshakeParams.put("action", "handshake");
        handshakeParams.put("token", "");
        handshakeParams.put("prehash", profile.prehash);
        handshakeParams.put("JsHttpRequest", "1-xml");

        ResponseData handshakeResponse = executeGet(endpoint + "?" + buildQuery(handshakeParams), headers);
        if (handshakeResponse.statusCode == 429) {
            throw new IOException("Portal handshake was rate-limited (429). Wait a few minutes, then retry once.");
        }
        if (handshakeResponse.statusCode < 200 || handshakeResponse.statusCode >= 300) {
            throw new IOException("Portal handshake failed with status " + handshakeResponse.statusCode + ".");
        }

        JSONObject handshakePayload = parsePortalResponse(handshakeResponse.body, false);
        JSONObject handshakeJs = handshakePayload.optJSONObject("js");
        String token = handshakeJs == null ? "" : handshakeJs.optString("token", "");
        if (token.isEmpty()) {
            throw new IOException("Portal handshake succeeded but no token was returned.");
        }

        LinkedHashMap<String, String> authorizedHeaders = new LinkedHashMap<>(headers);
        authorizedHeaders.put("Authorization", "Bearer " + token);

        LinkedHashMap<String, String> profileParams = new LinkedHashMap<>();
        profileParams.put("type", "stb");
        profileParams.put("action", "get_profile");
        profileParams.put("hd", profile.hd);
        profileParams.put("ver", profile.version);
        profileParams.put("num_banks", profile.numBanks);
        profileParams.put("sn", profile.serialNumber);
        profileParams.put("stb_type", profile.stbType);
        profileParams.put("client_type", profile.clientType);
        profileParams.put("image_version", profile.imageVersion);
        profileParams.put("video_out", profile.videoOut);
        profileParams.put("device_id", profile.deviceId);
        profileParams.put("device_id2", profile.deviceId2);
        profileParams.put("signature", profile.signature);
        profileParams.put("auth_second_step", "0");
        profileParams.put("hw_version", profile.hwVersion);
        profileParams.put("not_valid_token", handshakeJs != null && handshakeJs.optBoolean("not_valid") ? "1" : "0");
        profileParams.put("metrics", profile.metrics);
        profileParams.put("hw_version_2", profile.hwVersion2);
        profileParams.put("timestamp", profile.timestamp);
        profileParams.put("api_signature", profile.apiSignature);
        profileParams.put("prehash", profile.prehash);
        profileParams.put("JsHttpRequest", "1-xml");

        fetchPortalJson(new PortalSession(endpoint, authorizedHeaders), "?" + buildQuery(profileParams), false);

        PortalSession session = new PortalSession(endpoint, authorizedHeaders);
        SESSION_CACHE.put(cacheKey, new CachedSession(session, System.currentTimeMillis() + SESSION_TTL_MS));
        return session;
    }

    private String resolvePortalEndpoint(String portalUrl, String macAddress) throws Exception {
        String normalizedBase = normalizePortalBaseUrl(portalUrl);
        List<String> candidates = buildPortalCandidates(normalizedBase);
        String mac = normalizeMacAddress(macAddress);

        for (String candidate : candidates) {
            DeviceProfile probeProfile = buildPortalDeviceProfile(mac);
            LinkedHashMap<String, String> headers = new LinkedHashMap<>();
            headers.put("Accept", "application/json");
            headers.put("User-Agent", MAG_USER_AGENT);
            headers.put("X-User-Agent", MAG_USER_AGENT);
            headers.put("Cookie", probeProfile.cookies);
            headers.put("SN", probeProfile.serialNumber);
            headers.put("Referer", candidate);

            LinkedHashMap<String, String> params = new LinkedHashMap<>();
            params.put("type", "stb");
            params.put("action", "handshake");
            params.put("token", "");
            params.put("prehash", probeProfile.prehash);
            params.put("JsHttpRequest", "1-xml");

            try {
                ResponseData response = executeGet(candidate + "?" + buildQuery(params), headers);
                if (response.statusCode == 429) {
                    throw new IOException("Portal handshake was rate-limited (429). Wait a few minutes, then retry once.");
                }
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    continue;
                }

                JSONObject payload = parsePortalResponse(response.body, false);
                JSONObject js = payload.optJSONObject("js");
                if (js != null && !js.optString("token", "").isEmpty()) {
                    return candidate;
                }
            } catch (Exception exception) {
                if (exception.getMessage() != null && exception.getMessage().contains("429")) {
                    throw exception;
                }
            }
        }

        throw new IOException("Could not find a working portal endpoint for that server and MAC address.");
    }

    private JSONObject fetchPortalJson(PortalSession session, String query, boolean ignoreErrors) throws Exception {
        ResponseData response = executeGet(session.baseUrl + query, session.headers);
        if (response.statusCode == 429) {
            throw new IOException("Portal requests are being rate-limited (429). Wait a few minutes before trying again.");
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            if (ignoreErrors) {
                return new JSONObject();
            }
            throw new IOException("Portal request failed with status " + response.statusCode + ".");
        }

        return parsePortalResponse(response.body, ignoreErrors);
    }

    private JSONObject parsePortalResponse(String text, boolean ignoreErrors) throws Exception {
        String normalized = text == null ? "" : text.trim();
        try {
            return new JSONObject(normalized);
        } catch (JSONException ignored) {
            if (ignoreErrors) {
                return new JSONObject();
            }
            if (normalized.matches("(?is).*Unauthorized request\\..*")) {
                throw new IOException("Portal rejected the catalog request as unauthorized. The registered MAC may not match, or the provider expects stricter MAG device headers.");
            }
            if (normalized.matches("(?is).*Authorization failed\\..*")) {
                throw new IOException("Portal authorization failed after handshake. This usually means the MAC is not accepted for this device profile.");
            }

            String snippet = normalized.replaceAll("\\s+", " ");
            if (snippet.length() > 160) {
                snippet = snippet.substring(0, 160);
            }
            if (snippet.isEmpty()) {
                snippet = "[empty response]";
            }
            throw new IOException("Portal returned non-JSON content. Response preview: " + snippet);
        }
    }

    private ResponseData executeGet(String requestUrl, Map<String, String> headers) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(requestUrl).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestMethod("GET");
        connection.setInstanceFollowRedirects(true);
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            connection.setRequestProperty(entry.getKey(), entry.getValue());
        }

        int statusCode = connection.getResponseCode();
        InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String body = readStream(stream);
        connection.disconnect();
        return new ResponseData(statusCode, body);
    }

    private String readStream(InputStream stream) throws IOException {
        if (stream == null) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private JSObject buildPortalEntry(
        String id,
        String title,
        String groupTitle,
        String image,
        String portalType,
        String portalCommand,
        String contentType,
        Integer portalEpisode,
        String tvgId
    ) {
        JSObject entry = new JSObject();
        entry.put("id", slugify(id));
        entry.put("title", title == null ? "" : title.trim());
        entry.put("url", "");
        if (groupTitle != null && !groupTitle.isEmpty()) {
            entry.put("groupTitle", groupTitle);
        }
        if (tvgId != null && !tvgId.isEmpty()) {
            entry.put("tvgId", tvgId);
        }
        if (image != null && !image.isEmpty()) {
            entry.put("tvgLogo", image);
        }

        JSObject attrs = new JSObject();
        attrs.put("source-provider", "portal");
        attrs.put("portal-type", portalType);
        attrs.put("portal-command", portalCommand == null ? "" : portalCommand);
        attrs.put("content-type", contentType);
        if (portalEpisode != null) {
            attrs.put("portal-episode", String.valueOf(portalEpisode));
        }
        entry.put("attrs", attrs);
        return entry;
    }

    private String normalizePortalBaseUrl(String value) throws IOException {
        String trimmed = value == null ? "" : value.trim().replaceAll("/+$", "");
        if (trimmed.isEmpty()) {
            throw new IOException("Portal URL is required for MAC/portal providers.");
        }
        return trimmed.matches("(?i)^https?://.*") ? trimmed : "http://" + trimmed;
    }

    private List<String> buildPortalCandidates(String normalizedBase) {
        List<String> candidates = new ArrayList<>();
        if (normalizedBase.endsWith("/server/load.php") || normalizedBase.endsWith("/portal.php")) {
            candidates.add(normalizedBase);
            return candidates;
        }

        if (normalizedBase.contains("/stalker_portal") || normalizedBase.contains("/c")) {
            for (String endpoint : ENDPOINT_FILES) {
                candidates.add(collapseRepeatedSlashes(normalizedBase + "/" + endpoint));
            }
            return candidates;
        }

        for (String contextPath : CONTEXT_PATHS) {
            for (String endpoint : ENDPOINT_FILES) {
                String candidate = normalizedBase + (contextPath.isEmpty() ? "" : "/" + contextPath) + "/" + endpoint;
                candidates.add(collapseRepeatedSlashes(candidate));
            }
        }

        return candidates;
    }

    private String collapseRepeatedSlashes(String value) {
        return value.replaceAll("(?<!:)/{2,}", "/");
    }

    private String normalizeMacAddress(String value) throws IOException {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.US);
        if (!MAC_PATTERN.matcher(normalized).matches()) {
            throw new IOException("MAC address must use the format 00:1A:79:00:00:00.");
        }
        return normalized;
    }

    private DeviceProfile buildPortalDeviceProfile(String macAddress) throws Exception {
        String normalizedMac = normalizeMacAddress(macAddress);
        String compactMac = normalizedMac.replace(":", "");
        String serialNumber = buildSerialNumber(normalizedMac);
        String version =
            "ImageDescription: 0.2.18-r23-250; " +
            "ImageDate: Wed Oct 31 15:22:54 EEST 2018; " +
            "PORTAL version: " + DEFAULT_PORTAL_VERSION + "; " +
            "API Version: JS API version: 343;";

        String prehash = stableHash(DEFAULT_STB_TYPE + "|" + version.substring(0, Math.min(56, version.length())));
        String deviceId = stableHash("device_id:" + compactMac);
        String deviceId2 = stableHash("device_id2:" + compactMac);
        String randomSeed = stableHash("random:" + compactMac);
        String signature = stableHash("signature:" + randomSeed + ":" + compactMac);
        String metrics = "{\"mac\":\"" + normalizedMac + "\",\"sn\":\"" + serialNumber + "\",\"model\":\"" + DEFAULT_STB_TYPE + "\",\"type\":\"STB\",\"uid\":\"" + deviceId2 + "\",\"random\":\"" + randomSeed + "\"}";
        String timestamp = String.valueOf(System.currentTimeMillis() / 1000L);
        String adid = stableHash("adid:" + compactMac + ":" + timestamp).substring(0, 32);

        String cookies =
            "mac=" + normalizedMac +
            "; stb_lang=en" +
            "; timezone=UTC" +
            "; adid=" + adid +
            "; sn=" + serialNumber +
            "; stb_type=" + DEFAULT_STB_TYPE;

        return new DeviceProfile(
            "1",
            "2",
            DEFAULT_STB_TYPE,
            "STB",
            DEFAULT_IMAGE_VERSION,
            version,
            DEFAULT_HW_VERSION,
            "hdmi",
            serialNumber,
            deviceId,
            deviceId2,
            signature,
            metrics,
            stableHash(metrics + "|" + randomSeed),
            timestamp,
            DEFAULT_API_SIGNATURE,
            prehash,
            cookies
        );
    }

    private String buildSerialNumber(String seed) {
        String source = seed == null ? "" : seed.replaceAll("[^0-9A-F]", "").toUpperCase(Locale.US);
        if (source.isEmpty()) {
            source = "ABCDEF1234567";
        }
        return (source + "0000000000000").substring(0, 13);
    }

    private int parseSeasonNumber(String value, int fallback) {
        Matcher matcher = SEASON_PATTERN.matcher(value == null ? "" : value);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : fallback;
    }

    private String stableHash(String value) {
        long hashA = 0x811c9dc5L;
        long hashB = 0x01000193L;
        for (int index = 0; index < value.length(); index += 1) {
            int code = value.charAt(index);
            hashA ^= code;
            hashA = (hashA * 0x01000193L) & 0xffffffffL;
            hashB ^= code;
            hashB = (hashB * 0x85ebca6bL) & 0xffffffffL;
        }

        String combined = String.format(Locale.US, "%08X%08X", hashA, hashB);
        StringBuilder builder = new StringBuilder();
        while (builder.length() < 64) {
            builder.append(combined);
        }
        return builder.substring(0, 64);
    }

    private String buildQuery(Map<String, String> values) {
        List<String> pairs = new ArrayList<>();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            pairs.add(urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue() == null ? "" : entry.getValue()));
        }
        return String.join("&", pairs);
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String slugify(String value) {
        return value
            .toLowerCase(Locale.US)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-|-$)", "");
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.trim().isEmpty()) {
            return first;
        }
        return second;
    }

    private void appendAll(JSArray target, JSArray values) {
        for (int index = 0; index < values.length(); index += 1) {
            target.put(values.opt(index));
        }
    }

    private JSArray toJsArray(JSONArray array) {
        JSArray jsArray = new JSArray();
        for (int index = 0; index < array.length(); index += 1) {
            jsArray.put(array.opt(index));
        }
        return jsArray;
    }

    private static class ResponseData {
        private final int statusCode;
        private final String body;

        private ResponseData(int statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }
    }

    private static class PortalSession {
        private final String baseUrl;
        private final Map<String, String> headers;

        private PortalSession(String baseUrl, Map<String, String> headers) {
            this.baseUrl = baseUrl;
            this.headers = headers;
        }
    }

    private static class CachedSession {
        private final PortalSession session;
        private final long expiresAt;

        private CachedSession(PortalSession session, long expiresAt) {
            this.session = session;
            this.expiresAt = expiresAt;
        }
    }

    private static class DeviceProfile {
        private final String hd;
        private final String numBanks;
        private final String stbType;
        private final String clientType;
        private final String imageVersion;
        private final String version;
        private final String hwVersion;
        private final String videoOut;
        private final String serialNumber;
        private final String deviceId;
        private final String deviceId2;
        private final String signature;
        private final String metrics;
        private final String hwVersion2;
        private final String timestamp;
        private final String apiSignature;
        private final String prehash;
        private final String cookies;

        private DeviceProfile(
            String hd,
            String numBanks,
            String stbType,
            String clientType,
            String imageVersion,
            String version,
            String hwVersion,
            String videoOut,
            String serialNumber,
            String deviceId,
            String deviceId2,
            String signature,
            String metrics,
            String hwVersion2,
            String timestamp,
            String apiSignature,
            String prehash,
            String cookies
        ) {
            this.hd = hd;
            this.numBanks = numBanks;
            this.stbType = stbType;
            this.clientType = clientType;
            this.imageVersion = imageVersion;
            this.version = version;
            this.hwVersion = hwVersion;
            this.videoOut = videoOut;
            this.serialNumber = serialNumber;
            this.deviceId = deviceId;
            this.deviceId2 = deviceId2;
            this.signature = signature;
            this.metrics = metrics;
            this.hwVersion2 = hwVersion2;
            this.timestamp = timestamp;
            this.apiSignature = apiSignature;
            this.prehash = prehash;
            this.cookies = cookies;
        }
    }
}

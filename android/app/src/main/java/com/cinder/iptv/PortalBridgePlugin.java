package com.cinder.iptv;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PortalBridge")
public class PortalBridgePlugin extends Plugin {
    private final PortalBridgeService service = new PortalBridgeService();

    @PluginMethod
    public void testConnection(PluginCall call) {
        String portalUrl = call.getString("portalUrl");
        String macAddress = call.getString("macAddress");
        if (portalUrl == null || portalUrl.trim().isEmpty()) {
            call.reject("Portal URL is required.");
            return;
        }
        if (macAddress == null || macAddress.trim().isEmpty()) {
            call.reject("MAC address is required.");
            return;
        }

        getBridge().execute(() -> {
            try {
                service.testPortalConnection(portalUrl, macAddress);
                call.resolve();
            } catch (Exception exception) {
                call.reject(exception.getLocalizedMessage(), null, exception);
            }
        });
    }

    @PluginMethod
    public void importPlaylist(PluginCall call) {
        String portalUrl = call.getString("portalUrl");
        String macAddress = call.getString("macAddress");
        if (portalUrl == null || portalUrl.trim().isEmpty()) {
            call.reject("Portal URL is required.");
            return;
        }
        if (macAddress == null || macAddress.trim().isEmpty()) {
            call.reject("MAC address is required.");
            return;
        }

        getBridge().execute(() -> {
            try {
                JSArray entries = service.fetchPortalPlaylist(portalUrl, macAddress);
                JSObject result = new JSObject();
                result.put("entries", entries);
                call.resolve(result);
            } catch (Exception exception) {
                call.reject(exception.getLocalizedMessage(), null, exception);
            }
        });
    }

    @PluginMethod
    public void resolveStreamUrl(PluginCall call) {
        String portalUrl = call.getString("portalUrl");
        String macAddress = call.getString("macAddress");
        JSObject source = call.getObject("source");
        if (portalUrl == null || portalUrl.trim().isEmpty()) {
            call.reject("Portal URL is required.");
            return;
        }
        if (macAddress == null || macAddress.trim().isEmpty()) {
            call.reject("MAC address is required.");
            return;
        }
        if (source == null) {
            call.reject("Playback source is required.");
            return;
        }

        String portalType = source.optString("portalType", null);
        String portalCommand = source.optString("portalCommand", null);
        Integer portalEpisode = source.has("portalEpisode") ? source.optInt("portalEpisode") : null;
        if (portalType == null || portalType.trim().isEmpty() || portalCommand == null || portalCommand.trim().isEmpty()) {
            call.reject("Portal playback metadata is missing.");
            return;
        }

        getBridge().execute(() -> {
            try {
                String url = service.resolvePortalStreamUrl(portalUrl, macAddress, portalType, portalCommand, portalEpisode);
                JSObject result = new JSObject();
                result.put("url", url);
                call.resolve(result);
            } catch (Exception exception) {
                call.reject(exception.getLocalizedMessage(), null, exception);
            }
        });
    }
}

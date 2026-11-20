package com.driftwave.noise;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/** Lets the web app start/stop a foreground service so audio keeps playing with the screen off. */
@CapacitorPlugin(name = "Playback", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class PlaybackPlugin extends Plugin {
    static PlaybackPlugin instance;

    @Override
    public void load() { instance = this; }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        startService(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void afterPermission(PluginCall call) { startService(call); }

    private void startService(PluginCall call) {
        Intent i = new Intent(getContext(), PlaybackService.class);
        i.putExtra("title", call.getString("title", "Driftwave"));
        ContextCompat.startForegroundService(getContext(), i);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }

    /** Called by the notification's Stop button. */
    static void notifyStop() {
        if (instance != null) instance.notifyListeners("stop", new JSObject());
    }
}

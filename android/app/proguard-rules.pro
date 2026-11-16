# Capacitor core & custom plugins
-keep class com.getcapacitor.** { *; }
-keep class com.palrunner3d.app.** { *; }
-keepattributes *Annotation*,JavascriptInterface

# Unity Ads SDK & Google AdMob Mediation
-keep class com.unity3d.** { *; }
-dontwarn com.unity3d.**
-keep class com.google.ads.mediation.unity.** { *; }
-keep class com.google.android.gms.ads.** { *; }

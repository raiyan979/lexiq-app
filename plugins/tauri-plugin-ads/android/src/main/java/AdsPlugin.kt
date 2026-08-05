package com.plugin.ads

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

@TauriPlugin
class AdsPlugin(private val activity: Activity) : Plugin(activity) {
    private var interstitial: InterstitialAd? = null
    private var banner: AdView? = null
    private var initialized = false

    // Google's official TEST interstitial unit — shows a labelled "Test Ad" and
    // never bills. Swap for the real unit (ca-app-pub-3320114820264652/7247511143)
    // at the Play Store release.
    private val interstitialUnitId = "ca-app-pub-3940256099942544/1033173712"

    // Google's official TEST banner unit. Swap for the real unit
    // (ca-app-pub-3320114820264652/3252425819) at the Play Store release.
    private val bannerUnitId = "ca-app-pub-3940256099942544/6300978111"

    private fun ensureInitialized() {
        if (initialized) return
        initialized = true
        // Child-directed (COPPA) + G-rated content: this is a kids' app, so ads
        // must be non-personalized and family-safe regardless of the account
        // settings. Belt-and-suspenders with the AdMob console configuration.
        val config = RequestConfiguration.Builder()
            .setTagForChildDirectedTreatment(
                RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
            )
            .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
            .build()
        MobileAds.setRequestConfiguration(config)
        MobileAds.initialize(activity) {}
    }

    private fun buildRequest(): AdRequest {
        // npa=1 forces non-personalized ads.
        val extras = Bundle().apply { putString("npa", "1") }
        return AdRequest.Builder()
            .addNetworkExtrasBundle(AdMobAdapter::class.java, extras)
            .build()
    }

    @Command
    fun loadInterstitial(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                ensureInitialized()
                InterstitialAd.load(
                    activity,
                    interstitialUnitId,
                    buildRequest(),
                    object : InterstitialAdLoadCallback() {
                        override fun onAdLoaded(ad: InterstitialAd) {
                            interstitial = ad
                        }

                        override fun onAdFailedToLoad(error: LoadAdError) {
                            interstitial = null
                        }
                    }
                )
                invoke.resolve()
            } catch (ex: Exception) {
                invoke.reject(ex.message)
            }
        }
    }

    @Command
    fun showInterstitial(invoke: Invoke) {
        activity.runOnUiThread {
            val ad = interstitial
            if (ad != null) {
                ad.show(activity)
                interstitial = null
            }
            // Resolve either way — "no ad ready" is a normal, non-error outcome.
            invoke.resolve()
        }
    }

    /** Anchored adaptive banner sized to the screen width, for the current orientation. */
    private fun adaptiveSize(): AdSize {
        val metrics = activity.resources.displayMetrics
        val widthDp = (metrics.widthPixels / metrics.density).toInt()
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp)
    }

    @Command
    fun showBanner(invoke: Invoke) {
        activity.runOnUiThread {
            try {
                ensureInitialized()
                var view = banner
                val size: AdSize
                if (view == null) {
                    size = adaptiveSize()
                    view = AdView(activity).apply {
                        adUnitId = bannerUnitId
                        setAdSize(size)
                    }
                    // Add directly to the activity's content frame, pinned to the
                    // bottom-center. WRAP_CONTENT means it only occupies the banner
                    // strip, so taps elsewhere still reach the WebView. The web
                    // layout reserves `height` dp above it so nothing is covered.
                    val params = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    )
                    activity.addContentView(view, params)
                    view.loadAd(buildRequest())
                    banner = view
                } else {
                    size = view.adSize ?: adaptiveSize()
                    view.visibility = View.VISIBLE
                }
                val result = JSObject()
                result.put("height", size.height)
                invoke.resolve(result)
            } catch (ex: Exception) {
                invoke.reject(ex.message)
            }
        }
    }

    @Command
    fun hideBanner(invoke: Invoke) {
        activity.runOnUiThread {
            banner?.visibility = View.GONE
            invoke.resolve()
        }
    }
}

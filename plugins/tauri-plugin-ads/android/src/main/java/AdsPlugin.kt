package com.plugin.ads

import android.app.Activity
import android.os.Bundle
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

@TauriPlugin
class AdsPlugin(private val activity: Activity) : Plugin(activity) {
    private var interstitial: InterstitialAd? = null
    private var initialized = false

    // Google's official TEST interstitial unit — shows a labelled "Test Ad" and
    // never bills. Swap for the real unit (ca-app-pub-3320114820264652/7247511143)
    // at the Play Store release.
    private val interstitialUnitId = "ca-app-pub-3940256099942544/1033173712"

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
}

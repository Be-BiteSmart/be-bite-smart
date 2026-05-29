<?php

/**
 * AddToAny — append UTM params to shared URLs for attribution.
 *
 * Must run in the addtoany-core inline script *after* the plugin resets
 * a2a_config.callbacks (wp_head is too early). The share callback updates
 * data.url on each click (required for X and other direct service buttons).
 *
 * data-a2a-url on .a2a_kit is still the plain permalink in page HTML (set by the
 * plugin at render time). A ready callback syncs it to the UTM URL for consistency.
 */

function bebitesmart_addtoany_utm_inline_script() {
    if ( is_admin() ) {
        return;
    }

    // Plugin registers this handle in A2A_SHARE_SAVE_enqueue_script (priority 10).
    if ( ! wp_script_is( 'addtoany-core', 'registered' ) ) {
        return;
    }

    $inline_js = <<<'JS'
(function () {
	function bebitesmartUrlWithUtm(url) {
		try {
			var u = new URL(url, window.location.origin);
			u.searchParams.set('utm_source', 'word_of_mouth');
			u.searchParams.set('utm_medium', 'share');
			u.searchParams.set('utm_campaign', 'site_share');
			return u.href;
		} catch (e) {
			var base = (url || '').split('#')[0].split('?')[0];
			return (
				base +
				'?utm_source=word_of_mouth&utm_medium=share&utm_campaign=site_share'
			);
		}
	}

	window.a2a_config = window.a2a_config || {};
	a2a_config.linkurl = bebitesmartUrlWithUtm(
		window.location.href.split('#')[0]
	);
	a2a_config.callbacks = a2a_config.callbacks || [];
	function bebitesmartSyncA2aKitUrls() {
		var withUtm = bebitesmartUrlWithUtm(
			window.location.href.split('#')[0]
		);
		document.querySelectorAll('.a2a_kit[data-a2a-url]').forEach(function (kit) {
			kit.setAttribute('data-a2a-url', withUtm);
		});
	}

	a2a_config.callbacks.push({
		ready: bebitesmartSyncA2aKitUrls,
		share: function (data) {
			var withUtm = bebitesmartUrlWithUtm(
				data.url || window.location.href.split('#')[0]
			);
			if (withUtm !== data.url) {
				return { url: withUtm };
			}
		},
	});
})();
JS;

    wp_add_inline_script( 'addtoany-core', $inline_js, 'before' );
}

add_action( 'wp_enqueue_scripts', 'bebitesmart_addtoany_utm_inline_script', 20 );

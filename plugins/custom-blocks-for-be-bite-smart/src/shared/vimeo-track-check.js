/**
 * shared/vimeo-track-check.js
 * Editor-only: checks what caption/audio-track languages a Vimeo video
 * actually has, via a hidden Vimeo.Player embed + getTextTracks()/
 * getAudioTracks(). Used by video-quote/index.js to warn an admin when a
 * checked language checkbox doesn't have a matching track on Vimeo yet.
 */
import { useEffect, useRef, useState } from "@wordpress/element";
import { ensureVimeoSdk } from "./vimeo-sdk";
import { getVimeoId, normalizeLangCode } from "./languages";

const OFFSCREEN_STYLE = {
  position: "absolute",
  top: "-9999px",
  left: "-9999px",
  width: "200px",
  height: "113px", // nonzero size — display:none is suspected to break player init
  pointerEvents: "none",
};

/**
 * Lazily mounts a hidden Vimeo.Player for `vimeoUrl` (only while `active`
 * is true — pass isSelected from edit() so only the currently-selected
 * block ever has a hidden player alive) and fetches its text/audio track
 * language lists exactly once per distinct vimeoUrl, caching the result.
 *
 * @param {string}  vimeoUrl
 * @param {boolean} active
 * @return {{status: string, captionLangs: string[], audioLangs: string[], containerRef: Object, offscreenStyle: Object}}
 *   status: "idle" | "loading" | "ready" | "error"
 */
export function useVimeoTrackCheck(vimeoUrl, active) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const checkedUrlRef = useRef(null);
  const [state, setState] = useState({
    status: "idle",
    captionLangs: [],
    audioLangs: [],
  });

  useEffect(() => {
    const vimeoId = getVimeoId(vimeoUrl);

    if (!active || !vimeoId) {
      return;
    }

    if (checkedUrlRef.current === vimeoUrl && state.status === "ready") {
      return; // already have fresh data for this exact URL
    }

    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));

    ensureVimeoSdk()
      .then((Vimeo) => {
        if (cancelled || !containerRef.current) return;

        if (playerRef.current) {
          playerRef.current.destroy();
        }

        const player = new Vimeo.Player(containerRef.current, {
          id: vimeoId,
          autoplay: false,
          muted: true,
          controls: false,
        });
        playerRef.current = player;

        return Promise.all([player.getTextTracks(), player.getAudioTracks()]);
      })
      .then((result) => {
        if (cancelled || !result) return;
        const [textTracks, audioTracks] = result;
        checkedUrlRef.current = vimeoUrl;
        setState({
          status: "ready",
          captionLangs: textTracks.map((t) => normalizeLangCode(t.language)),
          audioLangs: audioTracks.map((t) => normalizeLangCode(t.language)),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Vimeo track check failed", err);
        setState({ status: "error", captionLangs: [], audioLangs: [] });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vimeoUrl, active]);

  // Destroy the hidden player and reset once the block is deselected, so
  // only the currently-selected block ever has a live embed.
  useEffect(() => {
    if (!active && playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
      checkedUrlRef.current = null;
      setState({ status: "idle", captionLangs: [], audioLangs: [] });
    }
  }, [active]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
    };
  }, []);

  return { ...state, containerRef, offscreenStyle: OFFSCREEN_STYLE };
}

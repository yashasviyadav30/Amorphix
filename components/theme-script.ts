// Runs before paint so a saved or requested theme, and a folded sidebar, show without a flash. `?theme=light|dark` sets and saves it.
export const THEME_SCRIPT = `try{var q=new URLSearchParams(location.search).get("theme");if(q==="light"||q==="dark")localStorage.setItem("amorphix-theme",q);var t=localStorage.getItem("amorphix-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem("amorphix-rail")==="1"||/(^|; )amorphix_demo=/.test(document.cookie))document.documentElement.dataset.rail="1";if(sessionStorage.getItem("amorphix-tour-go"))document.documentElement.dataset.veil="1"}catch(e){}`;

// Chrome offers to install the app very early in the page's life, before React is listening: keep the offer so the
// "Install app" button can use it once it mounts.
export const INSTALL_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__amorphixInstall=e;window.dispatchEvent(new Event("amorphix-installable"))});`;

// A deploy while someone has the app open takes the old code's pieces away, and the next part they open can't load
// (a ChunkLoadError) and hangs. Reload once to pick up the new code (at most once a minute, so it can never loop).
export const RELOAD_SCRIPT = `(function(){var bad=/ChunkLoadError|Loading chunk|Failed to load chunk/;function r(m){if(!bad.test(m))return;try{var t=+sessionStorage.getItem("amorphix-reload")||0;if(Date.now()-t<60000)return;sessionStorage.setItem("amorphix-reload",String(Date.now()))}catch(e){}location.reload()}window.addEventListener("error",function(e){r(String(e.message||(e.error&&e.error.name)||""))},true);window.addEventListener("unhandledrejection",function(e){var x=e.reason;r(String(x&&(x.name+" "+x.message)||x||""))})})();`;

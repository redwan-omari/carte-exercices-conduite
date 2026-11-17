/**
 * Mise à jour automatique de l'appli installée.
 *
 * Sur iPhone, une appli posée sur l'écran d'accueil est souvent seulement
 * « reprise » et jamais rechargée : sans aide, elle peut garder une ancienne
 * version très longtemps. On vérifie donc s'il existe une nouvelle version
 * à chaque retour dans l'appli (et toutes les 30 min), puis on recharge la page
 * dès que la nouvelle version est prête — sauf pendant une saisie en cours
 * (élément marqué data-unsaved), où l'on attend qu'elle soit terminée.
 */
const CHECK_EVERY_MS = 30 * 60 * 1000

function reloadWhenIdle() {
  if (document.querySelector('[data-unsaved]')) {
    window.setTimeout(reloadWhenIdle, 5000)
    return
  }
  window.location.reload()
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL
  // Première installation : la prise de contrôle n'est pas une mise à jour.
  let hadController = !!navigator.serviceWorker.controller
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (reloading) return
    reloading = true
    reloadWhenIdle()
  })

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      const check = () => {
        if (navigator.onLine) reg.update().catch(() => undefined)
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_EVERY_MS)
    } catch (e) {
      console.warn("Service worker non enregistré (l'appli marche quand même)", e)
    }
  }
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register())
}

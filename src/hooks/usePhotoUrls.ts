import { useEffect, useState } from 'react'
import { signedUrls } from '../lib/api'

export function usePhotoUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.join('|')

  useEffect(() => {
    if (!paths.length) return
    let cancelled = false
    signedUrls(paths)
      .then((u) => !cancelled && setUrls((prev) => ({ ...prev, ...u })))
      .catch((e) => console.error('URL photos', e))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}

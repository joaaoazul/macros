/** Guardar um ficheiro gerado na app.
 *
 *  Na web usa uma âncora com blob URL. No WebView do Android um blob URL não
 *  chega ao gestor de transferências, por isso escrevemos no cache da app e
 *  abrimos a folha de partilha do sistema (Guardar em Ficheiros, Drive, …).
 */

import { isNative } from './native'

/** Blob → base64 sem o prefixo `data:` (o Filesystem espera só os dados). */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export async function saveBlob(filename: string, blob: Blob): Promise<void> {
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: await toBase64(blob),
      directory: Directory.Cache,
    })
    await Share.share({ title: filename, url: uri })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

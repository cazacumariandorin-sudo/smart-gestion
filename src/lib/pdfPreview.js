// PDF.js se carga SOLO cuando hace falta pintar una miniatura (import dinámico),
// para no arrastrarlo al bundle inicial de la app.
// Build 'legacy': el build normal usa top-level await, incompatible con el objetivo
// de compilación de este proyecto.
let pdfjsPromise = null;

async function cargarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      // Vite: el sufijo ?url empaqueta el worker como archivo aparte y nos da su URL final.
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

const cache = new Map(); // url → dataURL de la miniatura, para no re-renderizar la misma foto varias veces

/**
 * Renderiza la PRIMERA página de un PDF como imagen (dataURL JPEG), escalada a `anchoMax` px.
 * Nunca lanza: si el PDF no se puede leer (roto, protegido, URL inválida…) devuelve null y
 * quien lo use debe mostrar el icono genérico de PDF como ya hacía antes.
 */
export async function renderPdfPrimeraPagina(url, anchoMax = 400) {
  if (!url) return null;
  const clave = `${url}@${anchoMax}`;
  if (cache.has(clave)) return cache.get(clave);
  try {
    const { getDocument } = await cargarPdfjs();
    const pdf = await getDocument({ url, isEvalSupported: false }).promise;
    const page = await pdf.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const escala = Math.min(2, anchoMax / vp1.width); // tope x2 para no generar miniaturas gigantes de PDFs muy estrechos
    const viewport = page.getViewport({ scale: escala });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    cache.set(clave, dataUrl);
    return dataUrl;
  } catch (e) {
    console.warn('[pdfPreview] No se pudo renderizar la miniatura', e);
    cache.set(clave, null); // no reintentar en bucle un PDF que ya sabemos que falla
    return null;
  }
}
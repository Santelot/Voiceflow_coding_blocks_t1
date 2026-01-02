/**
 * MakeCode Blocks Extension para VoiceFlow
 * Renderiza código JavaScript como bloques visuales de MakeCode
 */

const MakeCodeBlocksExtension = {
  name: 'MakeCodeBlocks',
  type: 'response',
  
  // Detectar si el trace contiene un comando para renderizar bloques
  match: ({ trace }) => {
    return trace.type === 'ext_makecodeBlocks' || trace.payload?.name === 'ext_makecodeBlocks';
  },
  
  // Renderizar los bloques en el chat
  render: ({ trace, element }) => {
    const payload = trace.payload || {};
    const code = payload.code || '';
    const platform = payload.platform || 'microbit'; // microbit, arcade, minecraft, etc.
    const packageId = payload.packageId || null; // Para proyectos compartidos
    
    if (!code && !packageId) {
      element.innerHTML = '<p style="color: red;">❌ No se proporcionó código para renderizar</p>';
      return;
    }
    
    // Crear contenedor para los bloques
    const container = document.createElement('div');
    container.className = 'makecode-blocks-container';
    container.style.cssText = `
      padding: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      margin: 10px 0;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    
    // Título
    const header = document.createElement('div');
    header.style.cssText = `
      color: white;
      font-weight: bold;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    header.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      </svg>
      <span>💎 Bloques de MakeCode</span>
    `;
    container.appendChild(header);
    
    // Área de loading
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'makecode-loading';
    loadingDiv.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      color: #667eea;
    `;
    loadingDiv.innerHTML = `
      <div class="spinner" style="
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 0 auto 10px;
      "></div>
      <p>Renderizando bloques...</p>
    `;
    container.appendChild(loadingDiv);
    
    // Pre element para el código (inicialmente oculto)
    const preElement = document.createElement('pre');
    preElement.id = `makecode-pre-${Date.now()}`;
    preElement.style.display = 'none';
    preElement.textContent = code;
    if (packageId) {
      preElement.setAttribute('data-packageid', packageId);
    }
    container.appendChild(preElement);
    
    element.appendChild(container);
    
    // Agregar estilos de animación si no existen
    if (!document.getElementById('makecode-spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'makecode-spinner-styles';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Inicializar el renderizador de MakeCode
    const platformUrls = {
      'microbit': 'https://makecode.microbit.org',
      'arcade': 'https://arcade.makecode.com',
      'minecraft': 'https://minecraft.makecode.com',
      'adafruit': 'https://makecode.adafruit.com',
      'chibitronics': 'https://makecode.chibitronics.com'
    };
    
    const baseUrl = platformUrls[platform] || platformUrls['microbit'];
    
    // Renderizar usando la función global
    window.renderMakeCodeBlock(preElement, baseUrl, () => {
      // Callback cuando termina de renderizar
      loadingDiv.remove();
    });
    
    // Botón para copiar código
    const copyButton = document.createElement('button');
    copyButton.style.cssText = `
      margin-top: 10px;
      padding: 8px 16px;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s;
    `;
    copyButton.textContent = '📋 Copiar Código';
    copyButton.onmouseover = () => {
      copyButton.style.background = '#f0f0f0';
      copyButton.style.transform = 'scale(1.05)';
    };
    copyButton.onmouseout = () => {
      copyButton.style.background = 'white';
      copyButton.style.transform = 'scale(1)';
    };
    copyButton.onclick = () => {
      navigator.clipboard.writeText(code).then(() => {
        copyButton.textContent = '✅ Copiado!';
        setTimeout(() => {
          copyButton.textContent = '📋 Copiar Código';
        }, 2000);
      });
    };
    container.appendChild(copyButton);
    
    // Cleanup function
    return () => {
      container.remove();
    };
  }
};

/**
 * Sistema Global de Renderizado de MakeCode
 * Maneja el iframe y la comunicación con MakeCode
 */
(function initMakeCodeRenderer() {
  // Verificar si ya existe
  if (window.makeCodeRendererInitialized) return;
  window.makeCodeRendererInitialized = true;
  
  let rendererIframe = null;
  let isRendererReady = false;
  let pendingRenders = [];
  let messageHandlerAdded = false;
  
  // Crear iframe del renderizador
  function createRendererIframe(baseUrl) {
    if (rendererIframe) return rendererIframe;
    
    const iframe = document.createElement('iframe');
    iframe.id = 'makecode-renderer';
    iframe.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1px;
      height: 1px;
      border: none;
    `;
    iframe.src = `${baseUrl}--docs?render=1`;
    document.body.appendChild(iframe);
    
    rendererIframe = iframe;
    return iframe;
  }
  
  // Procesar cola de renders pendientes
  function processPendingRenders() {
    while (pendingRenders.length > 0) {
      const render = pendingRenders.shift();
      sendRenderRequest(render.element, render.baseUrl, render.callback);
    }
  }
  
  // Enviar solicitud de renderizado
  function sendRenderRequest(preElement, baseUrl, callback) {
    if (!isRendererReady) {
      pendingRenders.push({ element: preElement, baseUrl, callback });
      return;
    }
    
    const iframe = rendererIframe || createRendererIframe(baseUrl);
    const code = preElement.textContent;
    const packageId = preElement.getAttribute('data-packageid');
    
    const message = {
      type: 'renderblocks',
      id: preElement.id,
      code: packageId ? '' : code,
      options: packageId ? { packageId } : {}
    };
    
    // Guardar callback para este render
    if (!window.makeCodeCallbacks) {
      window.makeCodeCallbacks = {};
    }
    window.makeCodeCallbacks[preElement.id] = callback;
    
    iframe.contentWindow.postMessage(message, baseUrl);
  }
  
  // Listener de mensajes del iframe
  function setupMessageListener(baseUrl) {
    if (messageHandlerAdded) return;
    messageHandlerAdded = true;
    
    window.addEventListener('message', (event) => {
      const msg = event.data;
      
      if (msg.source !== 'makecode') return;
      
      switch (msg.type) {
        case 'renderready':
          console.log('✅ MakeCode renderer listo');
          isRendererReady = true;
          processPendingRenders();
          break;
          
        case 'renderblocks':
          console.log('📦 Bloques renderizados:', msg.id);
          const preElement = document.getElementById(msg.id);
          
          if (!preElement) {
            console.warn('⚠️ Elemento pre no encontrado:', msg.id);
            return;
          }
          
          // Crear imagen con los bloques
          if (msg.svg && msg.uri) {
            const img = document.createElement('img');
            img.src = msg.uri;
            img.width = msg.width;
            img.height = msg.height;
            img.style.cssText = `
              max-width: 100%;
              height: auto;
              background: white;
              padding: 10px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            
            // Insertar imagen antes del pre y ocultar el pre
            preElement.parentNode.insertBefore(img, preElement);
            preElement.style.display = 'none';
            
            // Ejecutar callback si existe
            if (window.makeCodeCallbacks && window.makeCodeCallbacks[msg.id]) {
              window.makeCodeCallbacks[msg.id]();
              delete window.makeCodeCallbacks[msg.id];
            }
          } else if (msg.error) {
            console.error('❌ Error al renderizar:', msg.error);
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
              background: #fee;
              color: #c00;
              padding: 10px;
              border-radius: 8px;
              margin-top: 10px;
            `;
            errorDiv.textContent = `Error: ${msg.error}`;
            preElement.parentNode.insertBefore(errorDiv, preElement);
            preElement.style.display = 'none';
          }
          break;
      }
    }, false);
  }
  
  // Función global para renderizar bloques
  window.renderMakeCodeBlock = function(preElement, baseUrl = 'https://makecode.microbit.org', callback) {
    if (!preElement || !preElement.id) {
      console.error('❌ Elemento pre inválido o sin ID');
      return;
    }
    
    // Configurar listener si no existe
    setupMessageListener(baseUrl);
    
    // Crear iframe si no existe
    if (!rendererIframe) {
      createRendererIframe(baseUrl);
    }
    
    // Enviar solicitud (se agregará a la cola si el renderer no está listo)
    sendRenderRequest(preElement, baseUrl, callback);
  };
  
  console.log('🚀 MakeCode Renderer System inicializado');
})();

// Exportar la extensión
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MakeCodeBlocksExtension;
}

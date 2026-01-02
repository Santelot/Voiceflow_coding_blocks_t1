/**
 * EXTENSIÓN MAKECODE PARA VOICEFLOW
 * Paso 1/4: Copia este archivo a tu GitHub Pages / servidor
 * 
 * ¿Qué hace?: Detecta cuando VoiceFlow envía código y lo renderiza como bloques visuales
 */

const MakeCodeExtension = {
  name: 'MakeCode',
  type: 'response',
  
  // Detecta traces de tipo "makecode_blocks"
  match: ({trace}) => trace.type === 'makecode_blocks',
  
  // Renderiza los bloques
  render: ({trace, element}) => {
    const {code, platform = 'microbit'} = trace.payload || {};
    
    if (!code) {
      element.innerHTML = '<p style="color:red;">❌ No code provided</p>';
      return;
    }
    
    // Contenedor
    const container = document.createElement('div');
    container.style.cssText = 'padding:12px; background:#f5f5f5; border-radius:8px; margin:8px 0;';
    
    // Pre element (oculto)
    const pre = document.createElement('pre');
    pre.id = `mc-${Date.now()}`;
    pre.textContent = code;
    pre.style.display = 'none';
    
    // Loading
    const loading = document.createElement('div');
    loading.textContent = '⏳ Renderizando bloques...';
    loading.style.cssText = 'text-align:center; color:#666;';
    
    container.appendChild(loading);
    container.appendChild(pre);
    element.appendChild(container);
    
    // Renderizar
    window.renderMakeCodeBlocks(pre.id, code, platform, () => loading.remove());
  }
};

/**
 * SISTEMA DE RENDERIZADO
 * No tocar - maneja la comunicación con MakeCode
 */
(() => {
  let iframe, ready = false, queue = [];
  
  const URLS = {
    microbit: 'https://makecode.microbit.org',
    arcade: 'https://arcade.makecode.com',
    minecraft: 'https://minecraft.makecode.com'
  };
  
  function init(url) {
    if (iframe) return;
    iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
    iframe.src = url + '--docs?render=1';
    document.body.appendChild(iframe);
  }
  
  window.addEventListener('message', e => {
    const m = e.data;
    if (m.source !== 'makecode') return;
    
    if (m.type === 'renderready') {
      ready = true;
      queue.forEach(send);
      queue = [];
    }
    
    if (m.type === 'renderblocks') {
      const pre = document.getElementById(m.id);
      if (!pre) return;
      
      const img = document.createElement('img');
      img.src = m.uri;
      img.style.cssText = 'max-width:100%;background:white;padding:8px;border-radius:4px;';
      pre.parentNode.insertBefore(img, pre);
      
      const cb = window._mcCallbacks?.[m.id];
      if (cb) { cb(); delete window._mcCallbacks[m.id]; }
    }
  });
  
  function send({id, code, platform}) {
    const url = URLS[platform] || URLS.microbit;
    if (!iframe) init(url);
    iframe.contentWindow.postMessage({type: 'renderblocks', id, code}, url);
  }
  
  window.renderMakeCodeBlocks = (id, code, platform, cb) => {
    window._mcCallbacks = window._mcCallbacks || {};
    window._mcCallbacks[id] = cb;
    const item = {id, code, platform};
    ready ? send(item) : queue.push(item);
  };
})();

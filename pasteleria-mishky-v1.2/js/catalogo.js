let productosOriginales = [];
let productosValidados = [];
let categoriaActiva = "Todas";
let elementoIniciadorModal = null;

const regExtensionImagen = /\.(jpg|jpeg|png|webp|avif|svg)$/i;

// Nodos DOM
const $grilla = document.getElementById("grilla");
const $estado = document.getElementById("estado");
const $buscador = document.getElementById("buscador");
const $orden = document.getElementById("orden");
const $chkStock = document.getElementById("chk-stock");
const $modal = document.getElementById("modal-detalle");
const $btnCerrarModal = document.getElementById("btn-cerrar-modal");

// 1. Mostrar tarjetas Skeleton (Loading)
function mostrarSkeleton(cantidad = 8) {
  $grilla.setAttribute("aria-busy", "true");
  $grilla.innerHTML = "";
  const fragmento = document.createDocumentFragment();

  for (let i = 0; i < cantidad; i++) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");
    fragmento.appendChild(card);
  }
  $grilla.appendChild(fragmento);
}

// 2. Sanitización y Validación de Productos
function validarProductos(lista) {
  const idsVistos = new Set();
  const validos = [];

  lista.forEach((p) => {
    const esIdValido = typeof p.id === "number" && !idsVistos.has(p.id);
    const esPrecioValido = typeof p.precio === "number" && p.precio > 0;
    const esStockValido = Number.isInteger(p.stock) && p.stock >= 0;
    const esCategoriaValida = typeof p.categoria === "string" && p.categoria.trim() !== "";
    const esImagenValida = typeof p.imagen === "string" && regExtensionImagen.test(p.imagen);

    if (esIdValido && esPrecioValido && esStockValido && esCategoriaValida && esImagenValida) {
      idsVistos.add(p.id);
      validos.push(p);
    } else {
      console.warn("Producto descartado por datos inválidos:", p);
    }
  });

  return validos;
}

// 3. Carga Principal
async function iniciar() {
  mostrarSkeleton(8);
  $estado.textContent = "Cargando catálogo...";

  try {
    const respuesta = await fetch("data/productos.json");
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

    const datos = await respuesta.json();
    productosOriginales = datos;
    productosValidados = validarProductos(datos);

    sincronizarCategoriaDesdeHash();
    procesarYRenderizar();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    $grilla.innerHTML = "";
    $grilla.setAttribute("aria-busy", "false");
    $estado.innerHTML = `
      <span>Error al cargar el catálogo de productos.</span>
      <button id="btn-reintentar" type="button">Reintentar</button>
    `;
    document.getElementById("btn-reintentar")?.addEventListener("click", iniciar);
  }
}

// 4. Decodificación y Validación de location.hash
function sincronizarCategoriaDesdeHash() {
  const hash = decodeURIComponent(location.hash.replace("#", "").trim());
  const categoriasExistentes = [...new Set(productosValidados.map((p) => p.categoria))];

  if (hash && (hash === "Todas" || categoriasExistentes.includes(hash))) {
    categoriaActiva = hash;
  } else {
    categoriaActiva = "Todas";
  }

  document.querySelectorAll("[data-categoria]").forEach((btn) => {
    const coincide = btn.dataset.categoria === categoriaActiva;
    btn.setAttribute("aria-pressed", coincide ? "true" : "false");
  });
}

// 5. Filtrar y Ordenar
function procesarYRenderizar() {
  const textoBusqueda = $buscador.value.toLowerCase().trim();
  const ocultarSinStock = $chkStock.checked;
  const criterioOrden = $orden.value;

  const listaFiltrada = productosValidados.filter((p) => {
    const coincideCategoria = categoriaActiva === "Todas" || p.categoria === categoriaActiva;
    const coincideBusqueda = p.nombre.toLowerCase().includes(textoBusqueda);
    const coincideStock = !ocultarSinStock || p.stock > 0;

    return coincideCategoria && coincideBusqueda && coincideStock;
  });

  const listaProcesada = [...listaFiltrada].sort((a, b) => {
    if (criterioOrden === "precio-asc") return a.precio - b.precio;
    if (criterioOrden === "precio-desc") return b.precio - a.precio;
    if (criterioOrden === "nombre-asc") return a.nombre.localeCompare(b.nombre);
    return 0;
  });

  renderizarTarjetas(listaProcesada);
  actualizarEstado(listaProcesada.length);
  actualizarContadores();
}

// 6. Renderizado con replaceChildren() y Badges
function renderizarTarjetas(productos) {
  const tarjetas = productos.map((p) => {
    const article = document.createElement("article");
    article.className = "tarjeta-producto";
    article.tabIndex = 0;
    article.dataset.id = p.id;


    // Crear badge si es favorito o si está agotado
    let badgeHTML = "";
    if (p.stock === 0) {
      badgeHTML = `<span class="badge badge-agotado">Agotado</span>`;
    } else if (p.favorito) {
      badgeHTML = `<span class="badge badge-favorito">Favorito</span>`;
    }

    article.innerHTML = `
      <div class="contenedor-img">
        ${badgeHTML}
        <img 
          src="${p.imagen}" 
          sizes="(max-width: 600px) 100vw, 260px" 
          alt="${p.nombre}" 
          loading="lazy" 
        />
      </div>
      <div class="tarjeta-info">
        <h3>${p.nombre}</h3>
        <p><strong>S/ ${p.precio.toFixed(2)}</strong></p>
        <p><small>Stock: ${p.stock}</small></p>
      </div>
    `;

    const img = article.querySelector("img");
    img.addEventListener("load", () => img.classList.add("foto-cargada"));

    return article;
  });

  $grilla.replaceChildren(...tarjetas);
  $grilla.setAttribute("aria-busy", "false");
}

// 7. Actualización de texto en estado y contadores de botones sin destruir el DOM
function actualizarEstado(total) {
  $estado.textContent = `Mostrando ${total} productos en total.`;
}

function actualizarContadores() {
  const textoBusqueda = $buscador.value.toLowerCase().trim();
  const ocultarSinStock = $chkStock.checked;

  document.querySelectorAll("[data-categoria]").forEach((btn) => {
    const cat = btn.dataset.categoria;
    const total = productosValidados.filter((p) => {
      const coincideCat = cat === "Todas" || p.categoria === cat;
      const coincideBusqueda = p.nombre.toLowerCase().includes(textoBusqueda);
      const coincideStock = !ocultarSinStock || p.stock > 0;
      return coincideCat && coincideBusqueda && coincideStock;
    }).length;

    btn.textContent = `${cat} (${total})`;
  });
}

// 8. Eventos Globals
document.addEventListener("change", (e) => {
  if (e.target === $orden || e.target === $chkStock) {
    procesarYRenderizar();
  }
});

$buscador.addEventListener("input", procesarYRenderizar);

document.addEventListener("click", (e) => {
  const btnFiltro = e.target.closest("[data-categoria]");
  if (btnFiltro) {
    categoriaActiva = btnFiltro.dataset.categoria;
    history.replaceState(null, "", `#${encodeURIComponent(categoriaActiva)}`);

    document.querySelectorAll("[data-categoria]").forEach((b) => b.setAttribute("aria-pressed", "false"));
    btnFiltro.setAttribute("aria-pressed", "true");

    procesarYRenderizar();
    return;
  }

  const tarjeta = e.target.closest(".tarjeta-producto");
  if (tarjeta && $grilla.contains(tarjeta)) {
    const id = Number(tarjeta.dataset.id);
    const producto = productosValidados.find((p) => p.id === id);
    if (producto) {
      elementoIniciadorModal = tarjeta;
      abrirModal(producto);
    }
  }
});

$grilla.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const tarjeta = e.target.closest(".tarjeta-producto");
    if (tarjeta) {
      e.preventDefault();
      tarjeta.click();
    }
  }
});

// 9. Manejo de Modal Nativo <dialog>
function abrirModal(producto) {
  document.getElementById("modal-img").src = producto.imagen;
  document.getElementById("modal-img").alt = producto.nombre;
  document.getElementById("modal-nombre").textContent = producto.nombre;
  document.getElementById("modal-descripcion").textContent = producto.descripcion || "Delicioso producto horneado en Cusco.";
  document.getElementById("modal-precio").textContent = `Precio: S/ ${producto.precio.toFixed(2)}`;
  document.getElementById("modal-stock").textContent = `Stock disponible: ${producto.stock}`;

  $modal.showModal();
}

function cerrarModal() {
  $modal.close();
  if (elementoIniciadorModal) {
    elementoIniciadorModal.focus();
  }
}

$btnCerrarModal.addEventListener("click", cerrarModal);
$modal.addEventListener("cancel", cerrarModal);

window.addEventListener("popstate", () => {
  sincronizarCategoriaDesdeHash();
  procesarYRenderizar();
});

// 10. Modo claro / oscuro
const $btnTema = document.getElementById("btn-tema");

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  const esOscuro = tema === "oscuro";
  $btnTema.textContent = esOscuro ? "☀️" : "🌙";
  $btnTema.setAttribute("aria-label", esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
}

$btnTema.addEventListener("click", () => {
  const nuevo = document.documentElement.dataset.tema === "oscuro" ? "claro" : "oscuro";
  aplicarTema(nuevo);
  try { localStorage.setItem("tema", nuevo); } catch (e) {}
});

// Si el usuario no eligió manualmente, seguir el cambio del sistema operativo
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  let hayPreferenciaGuardada = false;
  try { hayPreferenciaGuardada = !!localStorage.getItem("tema"); } catch (err) {}
  if (!hayPreferenciaGuardada) aplicarTema(e.matches ? "oscuro" : "claro");
});

// Sincroniza el icono del botón con el tema que puso el script del <head>
aplicarTema(document.documentElement.dataset.tema || "claro");

// Iniciar aplicación
iniciar();
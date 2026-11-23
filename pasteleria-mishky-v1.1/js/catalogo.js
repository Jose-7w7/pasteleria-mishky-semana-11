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
const $chkFavoritos = document.getElementById("chk-favoritos");
const $btnAgregar = document.getElementById("btn-agregar");
const $btnPedido = document.getElementById("btn-pedido");
const $modalPedido = document.getElementById("modal-pedido");
const $listaPedido = document.getElementById("lista-pedido");
const $totalPedido = document.getElementById("total-pedido");

// localStorage seguro (puede fallar en modo privado)
function leerLS(clave, porDefecto) {
  try {
    const valor = JSON.parse(localStorage.getItem(clave));
    return valor ?? porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardarLS(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: la app sigue funcionando en memoria */
  }
}

// ===== RETO 1: Favoritos =====
let favoritos = new Set(leerLS("mishky-favoritos", []));
let productoModal = null;

function alternarFavorito(id) {
  if (favoritos.has(id)) favoritos.delete(id);
  else favoritos.add(id);
  guardarLS("mishky-favoritos", [...favoritos]);
}

// ===== RETO 2: Mi pedido (carrito) =====
let pedido = leerLS("mishky-pedido", {}); // { idProducto: cantidad }

const buscarProducto = (id) => productosValidados.find((p) => p.id === id);
const formatoSoles = (n) => `S/ ${n.toFixed(2)}`;

// Quita productos que ya no existen y ajusta cantidades al stock actual
function sanearPedido() {
  const limpio = {};
  Object.entries(pedido).forEach(([id, cant]) => {
    const p = buscarProducto(Number(id));
    const cantidad = Math.min(Number(cant) || 0, p ? p.stock : 0);
    if (p && cantidad > 0) limpio[id] = cantidad;
  });
  pedido = limpio;
  guardarLS("mishky-pedido", pedido);
}

function cambiarCantidad(id, delta) {
  const p = buscarProducto(id);
  if (!p) return;
  const nueva = Math.max(0, Math.min((pedido[id] || 0) + delta, p.stock));
  if (nueva === 0) delete pedido[id];
  else pedido[id] = nueva;
  guardarLS("mishky-pedido", pedido);
  actualizarPedidoUI();
}

function resumenPedido() {
  let items = 0;
  let total = 0;
  Object.entries(pedido).forEach(([id, cant]) => {
    const p = buscarProducto(Number(id));
    if (p) {
      items += cant;
      total += cant * p.precio;
    }
  });
  return { items, total };
}

function actualizarPedidoUI() {
  const { items, total } = resumenPedido();
  $btnPedido.textContent = items > 0 ? `Mi pedido (${items}) · ${formatoSoles(total)}` : "Mi pedido (0)";
  actualizarBotonAgregar();
  if ($modalPedido.open) renderizarPedido();
}

function actualizarBotonAgregar() {
  if (!productoModal) return;
  const enPedido = pedido[productoModal.id] || 0;
  if (productoModal.stock === 0) {
    $btnAgregar.textContent = "Agotado";
    $btnAgregar.disabled = true;
  } else if (enPedido >= productoModal.stock) {
    $btnAgregar.textContent = "Máximo disponible en tu pedido";
    $btnAgregar.disabled = true;
  } else {
    $btnAgregar.textContent = enPedido > 0 ? `Agregar otro (${enPedido} en el pedido)` : "Agregar al pedido";
    $btnAgregar.disabled = false;
  }
}

function renderizarPedido() {
  const filas = Object.keys(pedido).map((idTexto) => {
    const id = Number(idTexto);
    const p = buscarProducto(id);
    const li = document.createElement("li");
    li.className = "fila-pedido";
    li.innerHTML = `
      <span class="fila-nombre"></span>
      <span class="fila-controles">
        <button type="button" data-accion="restar" data-id="${id}" aria-label="Quitar uno">&minus;</button>
        <output>${pedido[id]}</output>
        <button type="button" data-accion="sumar" data-id="${id}" aria-label="Agregar uno" ${pedido[id] >= p.stock ? "disabled" : ""}>+</button>
      </span>
      <span class="fila-subtotal">${formatoSoles(pedido[id] * p.precio)}</span>
    `;
    li.querySelector(".fila-nombre").textContent = p.nombre;
    return li;
  });

  if (filas.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "pedido-vacio";
    vacio.textContent = "Aún no agregaste productos.";
    $listaPedido.replaceChildren(vacio);
  } else {
    $listaPedido.replaceChildren(...filas);
  }

  $totalPedido.textContent = `Total: ${formatoSoles(resumenPedido().total)}`;
  document.getElementById("btn-vaciar").hidden = filas.length === 0;
}

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
    sanearPedido();
    actualizarPedidoUI();

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
  const soloFavoritos = $chkFavoritos.checked;
  const criterioOrden = $orden.value;

  const listaFiltrada = productosValidados.filter((p) => {
    const coincideCategoria = categoriaActiva === "Todas" || p.categoria === categoriaActiva;
    const coincideBusqueda = p.nombre.toLowerCase().includes(textoBusqueda);
    const coincideStock = !ocultarSinStock || p.stock > 0;
    const coincideFavorito = !soloFavoritos || favoritos.has(p.id);

    return coincideCategoria && coincideBusqueda && coincideStock && coincideFavorito;
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

    const esFav = favoritos.has(p.id);
    article.innerHTML = `
      <div class="contenedor-img">
        ${badgeHTML}
        <button type="button" class="btn-favorito" data-fav="${p.id}"
          aria-pressed="${esFav}" aria-label="Marcar ${p.nombre} como favorito">${esFav ? "♥" : "♡"}</button>
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
  const soloFavoritos = $chkFavoritos.checked;

  document.querySelectorAll("[data-categoria]").forEach((btn) => {
    const cat = btn.dataset.categoria;
    const total = productosValidados.filter((p) => {
      const coincideCat = cat === "Todas" || p.categoria === cat;
      const coincideBusqueda = p.nombre.toLowerCase().includes(textoBusqueda);
      const coincideStock = !ocultarSinStock || p.stock > 0;
      const coincideFavorito = !soloFavoritos || favoritos.has(p.id);
      return coincideCat && coincideBusqueda && coincideStock && coincideFavorito;
    }).length;

    btn.textContent = `${cat} (${total})`;
  });
}

// 8. Eventos Globals
document.addEventListener("change", (e) => {
  if (e.target === $orden || e.target === $chkStock || e.target === $chkFavoritos) {
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

  const btnFav = e.target.closest(".btn-favorito");
  if (btnFav) {
    const id = Number(btnFav.dataset.fav);
    alternarFavorito(id);
    if ($chkFavoritos.checked) {
      procesarYRenderizar(); // el producto debe desaparecer de la lista
    } else {
      const activo = favoritos.has(id);
      btnFav.textContent = activo ? "♥" : "♡";
      btnFav.setAttribute("aria-pressed", activo);
    }
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
    // Si la tecla se presionó en el botón del corazón, que actúe el botón
    if (tarjeta && e.target === tarjeta) {
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

  productoModal = producto;
  actualizarBotonAgregar();
  $modal.showModal();
}

function cerrarModal() {
  $modal.close();
  if (elementoIniciadorModal) {
    elementoIniciadorModal.focus();
  }
}

$btnCerrarModal.addEventListener("click", cerrarModal);

// Eventos del pedido
$btnAgregar.addEventListener("click", () => {
  if (productoModal) cambiarCantidad(productoModal.id, 1);
});
$btnPedido.addEventListener("click", () => {
  renderizarPedido();
  $modalPedido.showModal();
});
document.getElementById("btn-cerrar-pedido").addEventListener("click", () => $modalPedido.close());
document.getElementById("btn-vaciar").addEventListener("click", () => {
  pedido = {};
  guardarLS("mishky-pedido", pedido);
  actualizarPedidoUI();
});
$listaPedido.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn) return;
  cambiarCantidad(Number(btn.dataset.id), btn.dataset.accion === "sumar" ? 1 : -1);
});
$modal.addEventListener("cancel", cerrarModal);

window.addEventListener("popstate", () => {
  sincronizarCategoriaDesdeHash();
  procesarYRenderizar();
});

// Iniciar aplicación
iniciar();
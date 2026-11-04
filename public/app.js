// State
let products = [];
let orders = [];
let channels = [];
let currentOrderFilter = "ready_to_ship";

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  refreshAll();
  // Poll every 8 seconds for new orders/updates
  setInterval(() => {
    loadStats();
    loadLogs();
    loadOrders(currentOrderFilter, false);
  }, 8000);
});

async function refreshAll() {
  await Promise.all([
    loadStats(),
    loadChannels(),
    loadProducts(),
    loadOrders(currentOrderFilter),
    loadLogs()
  ]);
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".nav-tab").forEach(el => {
    el.classList.remove("active-tab");
    el.classList.add("text-slate-400");
  });

  const targetPane = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetPane) targetPane.classList.remove("hidden");
  if (targetBtn) {
    targetBtn.classList.add("active-tab");
    targetBtn.classList.remove("text-slate-400");
  }
}

// Toast Notifications
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  const text = document.getElementById("toast-message");

  text.textContent = message;
  icon.innerHTML = isError
    ? '<i class="fa-solid fa-triangle-exclamation text-rose-400"></i>'
    : '<i class="fa-solid fa-circle-check text-emerald-400"></i>';

  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

// Dashboard & Stats
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    document.getElementById("stat-ready-to-ship").textContent = data.readyToShip;
    document.getElementById("stat-total-orders").textContent = data.totalOrders;
    document.getElementById("stat-revenue").textContent = `R$ ${data.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    document.getElementById("stat-products").textContent = data.totalProducts;

    const badge = document.getElementById("shipping-badge");
    if (data.readyToShip > 0) {
      badge.textContent = data.readyToShip;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch (err) {
    console.error("Erro ao carregar métricas:", err);
  }
}

// Channels
async function loadChannels() {
  try {
    const res = await fetch("/api/channels");
    channels = await res.json();

    const listEl = document.getElementById("channel-status-list");
    listEl.innerHTML = channels.map(c => {
      let iconColor = "text-amber-400 bg-amber-400/10";
      let badgeColor = "bg-amber-400/20 text-amber-300";
      if (c.id === "shopee") {
        iconColor = "text-orange-400 bg-orange-400/10";
        badgeColor = "bg-orange-400/20 text-orange-300";
      } else if (c.id === "tiktok") {
        iconColor = "text-rose-400 bg-rose-400/10";
        badgeColor = "bg-rose-400/20 text-rose-300";
      }

      const isLive = c.mode === "production";

      return `
        <div class="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center font-bold">
              ${c.id === "mercadolibre" ? "ML" : c.id === "shopee" ? "SHP" : "TTS"}
            </div>
            <div>
              <h4 class="font-bold text-white text-sm">${c.name}</h4>
              <p class="text-xs text-slate-400">Sync: Estoque & Pedidos</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-semibold px-2 py-0.5 rounded ${badgeColor}">
              ${isLive ? "Produção" : "Simulação"}
            </span>
          </div>
        </div>
      `;
    }).join("");

    // Populate Settings forms with existing values
    channels.forEach(c => {
      const form = document.getElementById(`form-channel-${c.id}`);
      if (form) {
        if (form.elements["mode"]) form.elements["mode"].value = c.mode || "sandbox";
        for (const [key, val] of Object.entries(c.credentials || {})) {
          if (form.elements[key]) form.elements[key].value = val;
        }
      }
    });
  } catch (err) {
    console.error("Erro ao carregar canais:", err);
  }
}

// Save Channel Configuration
async function saveChannelConfig(e, channelId) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const mode = formData.get("mode");
  const credentials = {};
  for (const [k, v] of formData.entries()) {
    if (k !== "mode") credentials[k] = v;
  }

  try {
    const res = await fetch(`/api/channels/${channelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, credentials })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Configurações de ${channelId} salvas com sucesso!`);
      loadChannels();
    }
  } catch (err) {
    showToast(`Erro ao salvar canal: ${err.message}`, true);
  }
}

// Activity Logs
async function loadLogs() {
  try {
    const res = await fetch("/api/logs");
    const logs = await res.json();
    const listEl = document.getElementById("activity-log-list");

    if (!logs || logs.length === 0) {
      listEl.innerHTML = '<p class="text-xs text-slate-500 py-3 text-center">Nenhuma atividade recente.</p>';
      return;
    }

    listEl.innerHTML = logs.map(l => {
      let icon = "fa-circle-info text-blue-400";
      if (l.type.includes("error")) icon = "fa-triangle-exclamation text-rose-400";
      else if (l.type.includes("stock")) icon = "fa-boxes-stacked text-indigo-400";
      else if (l.type.includes("order")) icon = "fa-cart-shopping text-emerald-400";
      else if (l.type.includes("publish")) icon = "fa-cloud-arrow-up text-amber-400";

      const time = new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      return `
        <div class="flex items-start space-x-3 text-xs bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/40">
          <i class="fa-solid ${icon} mt-0.5"></i>
          <div class="flex-1">
            <p class="text-slate-200 font-medium">${l.message}</p>
          </div>
          <span class="text-slate-500 font-mono">${time}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Erro ao carregar logs:", err);
  }
}

// Products Catalog
async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    products = await res.json();

    const tbody = document.getElementById("products-table-body");
    const simProductSelect = document.getElementById("sim-product-sku");

    // Populate simulate dropdown
    simProductSelect.innerHTML = products.map(p => `
      <option value="${p.sku}">${p.title} (Estoque: ${p.stock})</option>
    `).join("");

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-5 py-8 text-center text-slate-500">
            Nenhum produto cadastrado ainda. Clique em "Novo Produto" para começar.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const img = p.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop";

      const mlLink = p.links?.find(l => l.channel_id === "mercadolibre");
      const shpLink = p.links?.find(l => l.channel_id === "shopee");
      const ttsLink = p.links?.find(l => l.channel_id === "tiktok");

      const getBadge = (link, label, color) => {
        if (!link) return `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500 border border-slate-700">${label}: Não</span>`;
        if (link.status === "synced") return `<span class="px-2 py-0.5 rounded text-[10px] bg-${color}-500/20 text-${color}-300 font-semibold border border-${color}-500/30">✓ ${label}</span>`;
        return `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">✗ ${label}</span>`;
      };

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="px-5 py-4 flex items-center space-x-3">
            <img src="${img}" alt="${p.title}" class="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700">
            <div>
              <p class="font-bold text-white max-w-xs truncate">${p.title}</p>
              <p class="text-xs text-slate-400">Dim: ${p.height_cm}x${p.width_cm}x${p.length_cm} cm • ${p.weight_kg}kg</p>
            </div>
          </td>
          <td class="px-4 py-4 font-mono text-xs text-indigo-300 font-semibold">${p.sku}</td>
          <td class="px-4 py-4 font-bold text-emerald-400">R$ ${p.base_price.toFixed(2)}</td>
          <td class="px-4 py-4">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${p.stock <= 5 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}">
              ${p.stock} un
            </span>
          </td>
          <td class="px-5 py-4">
            <div class="flex flex-wrap gap-1.5">
              ${getBadge(mlLink, "ML", "amber")}
              ${getBadge(shpLink, "Shopee", "orange")}
              ${getBadge(ttsLink, "TikTok", "rose")}
            </div>
          </td>
          <td class="px-5 py-4 text-right space-x-2">
            <button onclick="publishExistingProduct('${p.id}')" title="Re-sincronizar ou Publicar nos Canais" class="p-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-xs font-medium">
              <i class="fa-solid fa-arrows-rotate mr-1"></i> Publicar
            </button>
            <button onclick="deleteProduct('${p.id}')" title="Excluir" class="p-2 text-slate-400 hover:text-rose-400 text-xs">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Erro ao carregar produtos:", err);
  }
}

// Modals
function openProductModal() {
  document.getElementById("modal-product").classList.remove("hidden");
}

function closeProductModal() {
  document.getElementById("modal-product").classList.add("hidden");
}

function openSimulateModal() {
  document.getElementById("modal-simulate").classList.remove("hidden");
}

function closeSimulateModal() {
  document.getElementById("modal-simulate").classList.add("hidden");
}

// Product Submit (1-Click Multi-Publish)
async function handleProductSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-save-product");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Publicando nos Canais...</span>';

  const productData = {
    title: document.getElementById("p-title").value,
    sku: document.getElementById("p-sku").value,
    description: document.getElementById("p-desc").value,
    base_price: parseFloat(document.getElementById("p-price").value),
    stock: parseInt(document.getElementById("p-stock").value),
    weight_kg: parseFloat(document.getElementById("p-weight").value) || 0.3,
    height_cm: parseFloat(document.getElementById("p-h").value) || 10,
    width_cm: parseFloat(document.getElementById("p-w").value) || 15,
    length_cm: parseFloat(document.getElementById("p-l").value) || 20,
    images: [document.getElementById("p-image").value || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop"],
    publishNow: true,
    channelSettings: {
      mercadolibre: { enabled: document.getElementById("pub-ml").checked },
      shopee: { enabled: document.getElementById("pub-shopee").checked },
      tiktok: { enabled: document.getElementById("pub-tiktok").checked }
    }
  };

  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData)
    });
    const data = await res.json();

    if (data.success) {
      showToast("Produto salvo e publicado em todos os canais selecionados!");
      closeProductModal();
      document.getElementById("product-form").reset();
      refreshAll();
    } else {
      showToast(data.error || "Erro ao salvar produto", true);
    }
  } catch (err) {
    showToast(`Erro: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>Salvar & Publicar Agora</span>';
  }
}

async function publishExistingProduct(productId) {
  try {
    showToast("Disparando publicação nos marketplaces...");
    const res = await fetch(`/api/products/${productId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (data.success) {
      showToast("Sincronização com os canais realizada com sucesso!");
      refreshAll();
    }
  } catch (err) {
    showToast(`Erro na publicação: ${err.message}`, true);
  }
}

async function deleteProduct(productId) {
  if (!confirm("Tem certeza que deseja remover este produto do catálogo?")) return;
  try {
    const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Produto excluído.");
      refreshAll();
    }
  } catch (err) {
    showToast(`Erro: ${err.message}`, true);
  }
}

// Orders & Shipping
function filterOrders(status) {
  currentOrderFilter = status;
  document.getElementById("order-filter-ready").className = status === "ready_to_ship"
    ? "px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white";
  document.getElementById("order-filter-shipped").className = status === "shipped"
    ? "px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white";
  document.getElementById("order-filter-all").className = status === "all"
    ? "px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 text-white"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400 hover:text-white";

  loadOrders(status);
}

async function loadOrders(status = "ready_to_ship", showLoading = true) {
  try {
    const res = await fetch(`/api/orders?status=${status}`);
    orders = await res.json();

    const container = document.getElementById("orders-container");

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-10 text-center text-slate-500">
          <i class="fa-solid fa-box-open text-3xl mb-2"></i>
          <p>Nenhum pedido encontrado nesta visualização.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(o => {
      let channelTag = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">🟡 Mercado Livre</span>';
      if (o.channel_id === "shopee") {
        channelTag = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-400/20 text-orange-300 border border-orange-400/30">🟠 Shopee</span>';
      } else if (o.channel_id === "tiktok") {
        channelTag = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-400/20 text-rose-300 border border-rose-400/30">⚫ TikTok Shop</span>';
      }

      const isReady = o.status === "ready_to_ship";
      const addr = o.shipping_address;

      return `
        <div class="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 hover:border-slate-600 transition space-y-4">
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-700/60">
            <div class="flex items-center space-x-3">
              ${channelTag}
              <span class="font-mono text-xs font-bold text-white">#${o.remote_order_id}</span>
              <span class="text-xs text-slate-400">• ${new Date(o.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${isReady ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}">
                ${isReady ? "Aguardando Envio" : "Despachado"}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <!-- Itens -->
            <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p class="font-bold text-slate-400 uppercase tracking-wide text-[10px] mb-2">Itens Comprados</p>
              ${o.items.map(it => `
                <div class="flex justify-between items-center py-1 border-b border-slate-800 last:border-0">
                  <span class="text-white font-medium truncate max-w-[160px]">${it.title}</span>
                  <span class="text-slate-400 font-mono">${it.quantity}x R$ ${it.unit_price.toFixed(2)}</span>
                </div>
              `).join("")}
              <div class="mt-2 text-right font-bold text-emerald-400 text-sm">
                Total: R$ ${o.total_amount.toFixed(2)}
              </div>
            </div>

            <!-- Destinatário -->
            <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <p class="font-bold text-slate-400 uppercase tracking-wide text-[10px] mb-2">Destinatário & Entrega</p>
              <p class="font-bold text-white">${o.customer_name}</p>
              <p class="text-slate-300 mt-0.5">${addr.street}, ${addr.number} ${addr.complement ? "- " + addr.complement : ""}</p>
              <p class="text-slate-400">${addr.neighborhood || ""} • ${addr.city}/${addr.state}</p>
              <p class="text-slate-500 mt-1 font-mono">CEP: ${addr.zip_code}</p>
            </div>

            <!-- Envio & Etiqueta -->
            <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div>
                <p class="font-bold text-slate-400 uppercase tracking-wide text-[10px] mb-2">Logística & Rastreio</p>
                <p class="font-semibold text-indigo-300">${o.shipping_service}</p>
                <p class="font-mono text-slate-400 mt-0.5">${o.tracking_code || "Aguardando geração"}</p>
              </div>

              <div class="flex space-x-2 mt-3 pt-2 border-t border-slate-800">
                <button onclick="printOrderLabel('${o.id}')" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center space-x-1 transition">
                  <i class="fa-solid fa-print mr-1"></i>
                  <span>Etiqueta</span>
                </button>
                ${isReady ? `
                  <button onclick="shipOrder('${o.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center space-x-1 transition">
                    <i class="fa-solid fa-check mr-1"></i>
                    <span>Despachar</span>
                  </button>
                ` : ""}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Erro ao carregar pedidos:", err);
  }
}

// Print Shipping Label
function printOrderLabel(orderId) {
  window.open(`/api/orders/${orderId}/label`, "_blank");
}

// Mark as Shipped
async function shipOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}/ship`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast("Pedido despachado! Notificação enviada ao marketplace.");
      refreshAll();
    }
  } catch (err) {
    showToast(`Erro ao despachar: ${err.message}`, true);
  }
}

// Simulate Sale Execution
async function triggerSimulateSale() {
  const channelId = document.getElementById("sim-channel").value;
  const sku = document.getElementById("sim-product-sku").value;
  const qty = parseInt(document.getElementById("sim-qty").value) || 1;
  const customer = document.getElementById("sim-customer").value;

  try {
    const res = await fetch("/api/orders/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        sku,
        quantity: qty,
        customerName: customer
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Venda simulada! ${qty} un. baixadas do estoque central.`);
      closeSimulateModal();
      refreshAll();
      // Auto-switch to shipping tab to view the label
      switchTab("shipping");
    } else {
      showToast(data.error || "Erro ao simular venda", true);
    }
  } catch (err) {
    showToast(`Erro: ${err.message}`, true);
  }
}

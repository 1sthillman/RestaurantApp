// Global variables
let orders = [];
let tables = [];
let products = [];
let orderSubscription = null;
let tableSubscription = null;

// Document ready function
document.addEventListener('DOMContentLoaded', async () => {
    // Load reference data
    await loadProducts();
    await loadTables();
    
    // Load orders
    await loadOrders();
    
    // Setup real-time subscriptions
    setupSubscriptions();
    
    // Update count badges initially
    updateOrderCountBadges();
});

// Load products from Supabase
async function loadProducts() {
    try {
        const { data, error } = await supabase.from('products').select('*');
        
        if (error) {
            console.error("Ürünler yüklenemedi:", error);
            return;
        }
        
        products = data;
    } catch (error) {
        console.error("Ürünler yüklenirken hata:", error);
    }
}

// Load tables from Supabase
async function loadTables() {
    try {
        const { data, error } = await supabase.from('tables').select('*').order('masa_no');
        
        if (error) {
            console.error("Masalar yüklenemedi:", error);
            document.getElementById('masa-durumlari').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill"></i> Masa bilgileri yüklenemedi.
                    </div>
                </div>
            `;
            return;
        }
        
        tables = data;
        renderTables();
    } catch (error) {
        console.error("Masalar yüklenirken hata:", error);
    }
}

// Load orders from Supabase
async function loadOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .in('durum', ['hazır', 'serviste', 'teslim edildi'])
            .order('zaman', { ascending: false });
        
        if (error) {
            console.error("Siparişler yüklenemedi:", error);
            return;
        }
        
        orders = data;
        renderOrders();
        updateOrderCountBadges();
    } catch (error) {
        console.error("Siparişler yüklenirken hata:", error);
    }
}

// Render tables
function renderTables() {
    const masaDurumlariEl = document.getElementById('masa-durumlari');
    
    if (!tables || tables.length === 0) {
        masaDurumlariEl.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> Kayıtlı masa bulunamadı.
                </div>
            </div>
        `;
        return;
    }
    
    let html = '';
    tables.forEach(table => {
        const isOccupied = table.durum !== 'boş';
        const statusClass = isOccupied ? 'busy' : '';
        const statusText = isOccupied ? table.durum : 'Boş';
        const statusBadgeClass = isOccupied ? 'bg-warning' : 'bg-success';
        
        html += `
            <div class="col-md-3 col-sm-4 col-6 mb-3">
                <div class="card table-card ${statusClass}" id="table-${table.masa_no}">
                    <div class="card-body">
                        <h5 class="card-title">Masa ${table.masa_no}</h5>
                        <span class="badge ${statusBadgeClass} status-badge">${statusText}</span>
                        ${
                            table.aktif_siparis ? 
                            `<div class="mt-2">
                                <small class="text-muted">Aktif Sipariş: #${table.aktif_siparis}</small>
                            </div>` : ''
                        }
                        <div class="mt-2">
                            <a href="menu.html?masa=${table.masa_no}" class="btn btn-sm btn-outline-primary mt-2" target="_blank">
                                <i class="bi bi-qr-code"></i> Menü QR
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    masaDurumlariEl.innerHTML = html;
}

// Render orders
function renderOrders() {
    // Filter orders by status
    const readyOrders = orders.filter(order => order.durum === 'hazır');
    const servingOrders = orders.filter(order => order.durum === 'serviste');
    const deliveredOrders = orders.filter(order => order.durum === 'teslim edildi');
    
    // Render ready orders
    renderOrdersByType('orders-ready', readyOrders, 'hazır');
    
    // Render serving orders
    renderOrdersByType('orders-serving', servingOrders, 'serviste');
    
    // Render delivered orders
    renderOrdersByType('orders-delivered', deliveredOrders, 'teslim edildi');
}

// Render orders by type
function renderOrdersByType(containerId, ordersList, status) {
    const containerEl = document.getElementById(containerId);
    
    if (!ordersList || ordersList.length === 0) {
        containerEl.innerHTML = `
            <div class="alert alert-light text-center">
                <i class="bi bi-info-circle"></i> Gösterilecek sipariş bulunmuyor.
            </div>
        `;
        return;
    }
    
    let html = '';
    ordersList.forEach(order => {
        html += createOrderCard(order, status);
    });
    
    containerEl.innerHTML = html;
    
    // Add event listeners to action buttons
    if (status === 'hazır') {
        document.querySelectorAll('.serve-order-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-id');
                updateOrderStatus(orderId, 'serviste');
            });
        });
    } else if (status === 'serviste') {
        document.querySelectorAll('.deliver-order-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-id');
                updateOrderStatus(orderId, 'teslim edildi');
            });
        });
    }
}

// Create order card HTML
function createOrderCard(order, status) {
    const time = new Date(order.zaman).toLocaleTimeString('tr-TR');
    let statusClass = '';
    let buttonHtml = '';
    
    switch (status) {
        case 'hazır':
            statusClass = 'ready';
            buttonHtml = `
                <button class="btn btn-success btn-sm serve-order-btn" data-id="${order.id}">
                    <i class="bi bi-check-lg"></i> Servise Al
                </button>
            `;
            break;
        case 'serviste':
            statusClass = '';
            buttonHtml = `
                <button class="btn btn-secondary btn-sm deliver-order-btn" data-id="${order.id}">
                    <i class="bi bi-check2-all"></i> Teslim Edildi
                </button>
            `;
            break;
        case 'teslim edildi':
            statusClass = 'delivered';
            break;
    }
    
    // Format order items
    let itemsHtml = '';
    if (order.urunler && order.urunler.length > 0) {
        order.urunler.forEach(item => {
            const product = products.find(p => p.id === item.urun_id);
            if (product) {
                itemsHtml += `
                    <div class="order-product-item">
                        <strong>${item.adet}x</strong> ${product.ad}
                    </div>
                `;
            }
        });
    } else {
        itemsHtml = '<div class="text-muted">Ürün bilgisi bulunamadı</div>';
    }
    
    let orderSourceBadge = '';
    if (order.kaynak === 'müşteri') {
        orderSourceBadge = '<span class="badge bg-info ms-2">Müşteri</span>';
    }
    
    return `
        <div class="card order-card ${statusClass} mb-3" id="order-${order.id}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">Masa ${order.masa} ${orderSourceBadge}</h6>
                </div>
                <span class="badge ${statusToColor(status)} status-badge">
                    ${statusToText(status)}
                </span>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    ${itemsHtml}
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${time}</small>
                    ${buttonHtml}
                </div>
            </div>
        </div>
    `;
}

// Convert status to text
function statusToText(status) {
    switch (status) {
        case 'hazır': return 'Hazır';
        case 'serviste': return 'Serviste';
        case 'teslim edildi': return 'Teslim Edildi';
        default: return status;
    }
}

// Convert status to color
function statusToColor(status) {
    switch (status) {
        case 'hazır': return 'bg-success';
        case 'serviste': return 'bg-primary';
        case 'teslim edildi': return 'bg-secondary';
        default: return 'bg-info';
    }
}

// Update order count badges
function updateOrderCountBadges() {
    const readyCount = orders.filter(order => order.durum === 'hazır').length;
    const servingCount = orders.filter(order => order.durum === 'serviste').length;
    const deliveredCount = orders.filter(order => order.durum === 'teslim edildi').length;
    
    document.getElementById('hazir-count').textContent = readyCount;
    document.getElementById('servis-count').textContent = servingCount;
    document.getElementById('teslim-count').textContent = deliveredCount;
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .update({ durum: newStatus })
            .eq('id', orderId);
        
        if (error) {
            console.error('Sipariş durumu güncellenirken hata:', error);
            alert('Sipariş durumu güncellenemedi. Lütfen tekrar deneyin.');
            return;
        }
        
        // The update will come through the subscription
    } catch (error) {
        console.error('Sipariş durumu güncellenirken hata:', error);
        alert('Sipariş durumu güncellenirken bir hata oluştu.');
    }
}

// Setup real-time subscriptions
function setupSubscriptions() {
    // Subscribe to order updates
    orderSubscription = subscribeToOrders(null, (payload) => {
        const { eventType, new: newOrder, old: oldOrder } = payload;
        
        switch (eventType) {
            case 'INSERT':
                if (newOrder.durum === 'hazır') {
                    orders = [newOrder, ...orders];
                    notifyNewOrder();
                }
                break;
                
            case 'UPDATE':
                // Find and update the order in our local array
                const index = orders.findIndex(order => order.id === newOrder.id);
                if (index !== -1) {
                    orders[index] = newOrder;
                } else if (['hazır', 'serviste', 'teslim edildi'].includes(newOrder.durum)) {
                    // If we don't have the order but it's now in a state we track, add it
                    orders = [newOrder, ...orders];
                }
                break;
                
            case 'DELETE':
                orders = orders.filter(order => order.id !== oldOrder.id);
                break;
        }
        
        renderOrders();
        updateOrderCountBadges();
    });
    
    // Subscribe to table updates
    tableSubscription = subscribeToTables((payload) => {
        const { eventType, new: newTable } = payload;
        
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
            const index = tables.findIndex(table => table.masa_no === newTable.masa_no);
            if (index !== -1) {
                tables[index] = newTable;
            } else {
                tables.push(newTable);
            }
            renderTables();
        }
    });
}

// Notify about new ready orders
function notifyNewOrder() {
    // Show notification for new ready orders
    const alertEl = document.createElement('div');
    alertEl.className = 'alert alert-success alert-dismissible fade show fixed-top w-75 mx-auto mt-3';
    alertEl.innerHTML = `
        <strong><i class="bi bi-bell-fill"></i> Yeni Hazır Sipariş!</strong> Mutfaktan yeni bir hazır sipariş geldi.
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertEl);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertEl);
        bsAlert.close();
    }, 5000);
} 
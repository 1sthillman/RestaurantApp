// Global variables
let orders = [];
let products = [];
let orderSubscription = null;
let orderItemsSubscription = null;

// Document ready function
document.addEventListener('DOMContentLoaded', async () => {
    // Check connection
    const connected = await checkConnection();
    if (!connected) {
        showError("Veritabanı bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.");
        return;
    }
    
    // Load products for reference
    await loadProducts();
    
    // Load active orders
    await loadOrders();
    
    // Setup real-time updates
    setupOrderSubscription();
});

// Load products from Supabase
async function loadProducts() {
    try {
        const { data, error } = await supabase.from('urunler').select('*');
        
        if (error) {
            console.error("Ürünler yüklenemedi:", error);
            return;
        }
        
        products = data;
    } catch (error) {
        console.error("Ürünler yüklenirken hata:", error);
    }
}

// Show error message
function showError(message) {
    document.getElementById('orders-preparing').innerHTML = `
        <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle-fill"></i> ${message}
        </div>
    `;
}

// Load orders from Supabase
async function loadOrders() {
    try {
        // Get pending orders
        const { data: orderData, error: orderError } = await supabase
            .from('siparisler')
            .select('*')
            .in('durum', ['beklemede', 'hazirlaniyor', 'tamamlandi'])
            .order('olusturma_zamani', { ascending: true });
        
        if (orderError) {
            console.error("Siparişler yüklenemedi:", orderError);
            showError("Siparişler yüklenemedi.");
            return;
        }
        
        orders = orderData;
        
        // For each order, get its items
        for (const order of orders) {
            const { data: orderItems, error: itemsError } = await supabase
                .from('siparis_kalemleri')
                .select('*')
                .eq('siparis_id', order.id);
                
            if (!itemsError && orderItems) {
                order.siparis_kalemleri = orderItems;
            }
        }
        
        renderOrders();
    } catch (error) {
        console.error("Siparişler yüklenirken hata:", error);
        showError("Bir hata oluştu.");
    }
}

// Render orders
function renderOrders() {
    const preparingOrdersEl = document.getElementById('orders-preparing');
    const readyOrdersEl = document.getElementById('orders-ready');
    
    // Filter orders by status
    const pendingOrders = orders.filter(order => order.durum === 'beklemede');
    const preparingOrders = orders.filter(order => order.durum === 'hazirlaniyor');
    const readyOrders = orders.filter(order => order.durum === 'tamamlandi');
    
    // Render pending orders
    if (pendingOrders.length === 0 && preparingOrders.length === 0) {
        preparingOrdersEl.innerHTML = `
            <div class="alert alert-light text-center">
                <i class="bi bi-info-circle"></i> Hazırlanacak sipariş bulunmuyor.
            </div>
        `;
    } else {
        let html = '';
        
        // First show pending orders
        pendingOrders.forEach(order => {
            html += createOrderCard(order, 'beklemede');
        });
        
        // Then show preparing orders
        preparingOrders.forEach(order => {
            html += createOrderCard(order, 'hazirlaniyor');
        });
        
        preparingOrdersEl.innerHTML = html;
        
        // Add event listeners to buttons
        document.querySelectorAll('.start-preparing-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-id');
                updateOrderStatus(orderId, 'hazirlaniyor');
            });
        });
        
        document.querySelectorAll('.order-ready-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-id');
                updateOrderStatus(orderId, 'tamamlandi');
            });
        });
    }
    
    // Render ready orders
    if (readyOrders.length === 0) {
        readyOrdersEl.innerHTML = `
            <div class="alert alert-light text-center">
                <i class="bi bi-info-circle"></i> Hazır sipariş bulunmuyor.
            </div>
        `;
    } else {
        let html = '';
        readyOrders.forEach(order => {
            html += createOrderCard(order, 'tamamlandi');
        });
        readyOrdersEl.innerHTML = html;
        
        // Add event listeners for delivered buttons
        document.querySelectorAll('.order-delivered-btn').forEach(button => {
            button.addEventListener('click', function() {
                const orderId = this.getAttribute('data-id');
                updateOrderStatus(orderId, 'teslim_edildi');
            });
        });
    }
}

// Create order card HTML
function createOrderCard(order, status) {
    const time = new Date(order.olusturma_zamani || order.created_at).toLocaleTimeString('tr-TR');
    let statusClass = '';
    let buttonHtml = '';
    
    if (status === 'beklemede') {
        statusClass = 'border-warning';
        buttonHtml = `
            <button class="btn btn-warning btn-sm start-preparing-btn" data-id="${order.id}">
                <i class="bi bi-hourglass-start"></i> Hazırlamaya Başla
            </button>
        `;
    } else if (status === 'hazirlaniyor') {
        statusClass = 'border-primary';
        buttonHtml = `
            <button class="btn btn-success btn-sm order-ready-btn" data-id="${order.id}">
                <i class="bi bi-check-lg"></i> Hazırlandı
            </button>
        `;
    } else if (status === 'tamamlandi') {
        statusClass = 'border-success';
        buttonHtml = `
            <button class="btn btn-info btn-sm order-delivered-btn" data-id="${order.id}">
                <i class="bi bi-truck"></i> Teslim Edildi
            </button>
        `;
    }
    
    // Format order items
    let itemsHtml = '';
    let itemsList = order.siparis_kalemleri || [];
    
    if (itemsList.length > 0) {
        itemsList.forEach(item => {
            itemsHtml += `
                <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                    <div>
                        <strong>${item.miktar}x</strong> ${item.urun_adi}
                    </div>
                    <span>${formatCurrency(item.toplam_fiyat)}</span>
                </div>
            `;
        });
    } else if (order.urunler && Array.isArray(order.urunler)) {
        // Fallback to order.urunler if available
        order.urunler.forEach(item => {
            const productName = item.urun_adi || 'Ürün';
            itemsHtml += `
                <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                    <div>
                        <strong>${item.miktar}x</strong> ${productName}
                    </div>
                    <span>${formatCurrency(item.toplam_fiyat || 0)}</span>
                </div>
            `;
        });
    } else {
        itemsHtml = '<div class="text-muted">Ürün bilgisi bulunamadı</div>';
    }
    
    return `
        <div class="card order-card ${statusClass} mb-3" id="order-${order.id}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Masa ${order.masa_no}</h5>
                <span class="badge ${
                    status === 'beklemede' ? 'bg-warning' : 
                    status === 'hazirlaniyor' ? 'bg-primary' : 
                    'bg-success'
                }">
                    ${
                        status === 'beklemede' ? 'Beklemede' : 
                        status === 'hazirlaniyor' ? 'Hazırlanıyor' : 
                        'Hazır'
                    }
                </span>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    ${itemsHtml}
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <small class="text-muted">Sipariş: ${time}</small>
                        <div class="mt-1"><strong>Toplam:</strong> ${formatCurrency(order.toplam_fiyat)}</div>
                    </div>
                    ${buttonHtml}
                </div>
            </div>
        </div>
    `;
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        // Update main order
        const { error: orderError } = await supabase
            .from('siparisler')
            .update({ durum: newStatus })
            .eq('id', orderId);
        
        if (orderError) {
            console.error('Sipariş durumu güncellenirken hata:', orderError);
            alert('Sipariş durumu güncellenemedi.');
            return;
        }
        
        if (newStatus === 'teslim_edildi') {
            // Also update the table status
            const order = orders.find(o => o.id === orderId);
            if (order && order.masa_id) {
                await supabase
                    .from('masalar')
                    .update({ durum: 'teslim_edildi' })
                    .eq('id', order.masa_id);
            }
            
            // Remove from local array
            orders = orders.filter(order => order.id !== orderId);
            renderOrders();
        }
        
    } catch (error) {
        console.error('Sipariş durumu güncellenirken hata:', error);
        alert('Sipariş durumu güncellenirken bir hata oluştu.');
    }
}

// Setup order subscription
function setupOrderSubscription() {
    // Subscribe to all siparisler changes
    orderSubscription = supabase
        .channel('custom-orders-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'siparisler'
            },
            handleOrderUpdate
        )
        .subscribe();
        
    // Subscribe to order items changes
    orderItemsSubscription = supabase
        .channel('custom-order-items-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'siparis_kalemleri'
            },
            handleOrderItemsUpdate
        )
        .subscribe();
}

// Handle order updates
async function handleOrderUpdate(payload) {
    const { eventType, new: newOrder, old: oldOrder } = payload;
    
    switch (eventType) {
        case 'INSERT':
            // Check if the order is in a status we're interested in
            if (['beklemede', 'hazirlaniyor', 'tamamlandi'].includes(newOrder.durum)) {
                // Fetch order items
                const { data: orderItems } = await supabase
                    .from('siparis_kalemleri')
                    .select('*')
                    .eq('siparis_id', newOrder.id);
                
                newOrder.siparis_kalemleri = orderItems || [];
                orders = [newOrder, ...orders];
                playSoundAlert();
            }
            break;
            
        case 'UPDATE':
            // If status changed to a status we're tracking
            if (['beklemede', 'hazirlaniyor', 'tamamlandi'].includes(newOrder.durum)) {
                const index = orders.findIndex(order => order.id === newOrder.id);
                
                if (index !== -1) {
                    // Update but preserve order items
                    const orderItems = orders[index].siparis_kalemleri;
                    orders[index] = { ...newOrder, siparis_kalemleri: orderItems };
                } else {
                    // New to our view, fetch order items
                    const { data: orderItems } = await supabase
                        .from('siparis_kalemleri')
                        .select('*')
                        .eq('siparis_id', newOrder.id);
                    
                    newOrder.siparis_kalemleri = orderItems || [];
                    orders = [newOrder, ...orders];
                }
            } else if (['teslim_edildi', 'servis_edildi', 'iptal'].includes(newOrder.durum)) {
                // Remove from our view
                orders = orders.filter(order => order.id !== newOrder.id);
            }
            break;
            
        case 'DELETE':
            orders = orders.filter(order => order.id !== oldOrder.id);
            break;
    }
    
    renderOrders();
}

// Handle order items updates
async function handleOrderItemsUpdate(payload) {
    const { eventType, new: newItem, old: oldItem } = payload;
    
    // Find the order this item belongs to
    const orderId = newItem?.siparis_id || oldItem?.siparis_id;
    if (!orderId) return;
    
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) return;
    
    // Update the items list for this order
    const { data: orderItems } = await supabase
        .from('siparis_kalemleri')
        .select('*')
        .eq('siparis_id', orderId);
        
    if (orderItems) {
        orders[orderIndex].siparis_kalemleri = orderItems;
        renderOrders();
    }
}

// Play sound alert for new orders
function playSoundAlert() {
    // Create a temporary audio element
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.5;
    audio.play()
        .catch(e => console.log('Sound couldn\'t play automatically:', e));
    
    // Show visual alert
    const alertEl = document.createElement('div');
    alertEl.className = 'alert alert-warning alert-dismissible fade show fixed-top w-75 mx-auto mt-3';
    alertEl.innerHTML = `
        <strong><i class="bi bi-bell-fill"></i> Yeni Sipariş!</strong> Mutfağa yeni bir sipariş geldi.
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertEl);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alertEl);
        bsAlert.close();
    }, 5000);
} 
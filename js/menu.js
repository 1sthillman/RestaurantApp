// Global variables
let tableNumber = null;
let tableData = null;
let products = [];
let categories = [];
let cart = [];
let orderSubscription = null;

// Document ready function
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Supabase connection
        const connected = await checkConnection();
        if (!connected) {
            showError("Veritabanı bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.");
            return;
        }

        // Get table number from URL
        tableNumber = getTableNumber();
        
        if (!tableNumber) {
            showError("Masa numarası bulunamadı. Lütfen QR kodu tekrar okutun.");
            return;
        }
        
        // Display table number
        document.getElementById('masa-no').textContent = `Masa ${tableNumber}`;
        
        // Check table availability
        tableData = await checkTableAvailability(tableNumber);
        if (!tableData) {
            showError("Masa bilgisi bulunamadı veya bu masa kullanılamaz.");
            return;
        }
        
        // Load categories and products
        await loadCategories();
        await loadProducts();
        
        // Setup cart functionality
        setupCartListeners();
        
        // Subscribe to order updates for this table
        setupOrderSubscription();
    } catch (error) {
        console.error("Veri yükleme hatası:", error);
        showError("Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    }
});

// Load categories
async function loadCategories() {
    try {
        const { data, error } = await supabase
            .from('kategoriler')
            .select('*')
            .order('sira', { ascending: true });
        
        if (error) {
            console.error("Kategorileri yükleme hatası:", error);
            return;
        }
        
        categories = data;
    } catch (error) {
        console.error("Kategorileri yükleme hatası:", error);
    }
}

// Show error message
function showError(message) {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle-fill"></i> ${message}
        </div>
    `;
}

// Load products from Supabase
async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('urunler')
            .select('*, kategoriler(*)');
        
        if (error) {
            console.error("Ürünler yüklenemedi:", error);
            showError("Menü yüklenemedi. Lütfen daha sonra tekrar deneyin.");
            return;
        }
        
        products = data;
        renderMenu();
    } catch (error) {
        console.error("Ürünler yüklenirken hata:", error);
        showError("Menü yüklenirken bir hata oluştu.");
    }
}

// Render menu with categories
function renderMenu() {
    const menuContainer = document.getElementById('menu-container');
    
    if (!categories || categories.length === 0 || !products || products.length === 0) {
        menuContainer.innerHTML = `
            <div class="alert alert-info" role="alert">
                Menüde görüntülenecek ürün bulunamadı.
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Create category tabs
    html += '<div class="mb-4"><div class="nav nav-pills mb-3" id="menu-tab" role="tablist">';
    categories.forEach((category, index) => {
        html += `
            <button class="nav-link ${index === 0 ? 'active' : ''}" 
                id="tab-${category.id}" 
                data-bs-toggle="pill" 
                data-bs-target="#content-${category.id}" 
                type="button" 
                role="tab">
                ${category.ad}
            </button>
        `;
    });
    html += '</div></div>';
    
    // Create tab content
    html += '<div class="tab-content" id="menu-tabContent">';
    categories.forEach((category, index) => {
        const categoryProducts = products.filter(p => p.kategori_id === category.id);
        
        html += `
            <div class="tab-pane fade ${index === 0 ? 'show active' : ''}" 
                id="content-${category.id}" 
                role="tabpanel">
                <div class="row">
        `;
        
        if (categoryProducts.length === 0) {
            html += `
                <div class="col-12">
                    <div class="alert alert-light">
                        Bu kategoride ürün bulunmamaktadır.
                    </div>
                </div>
            `;
        } else {
            categoryProducts.forEach(product => {
                html += createProductCard(product);
            });
        }
        
        html += '</div></div>';
    });
    html += '</div>';
    
    menuContainer.innerHTML = html;
    
    // Add click events to "Add to Cart" buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.getAttribute('data-id');
            addToCart(productId);
        });
    });
}

// Create product card HTML
function createProductCard(product) {
    return `
        <div class="col-md-4 col-sm-6 menu-item mb-4">
            <div class="card h-100">
                ${product.image_url ? 
                    `<img src="${product.image_url}" class="card-img-top" alt="${product.ad}">` : 
                    `<div class="card-img-top bg-secondary text-white d-flex align-items-center justify-content-center" style="height: 140px;">
                        <i class="bi bi-image" style="font-size: 2rem;"></i>
                    </div>`
                }
                <div class="card-body">
                    <h5 class="card-title">${product.ad}</h5>
                    <p class="card-text">${formatCurrency(product.fiyat)}</p>
                </div>
                <div class="card-footer bg-transparent border-top-0">
                    <button class="btn btn-primary w-100 add-to-cart" data-id="${product.id}">
                        <i class="bi bi-cart-plus"></i> Sepete Ekle
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Setup cart listeners
function setupCartListeners() {
    // Order button click
    document.getElementById('siparis-ver-btn').addEventListener('click', submitOrder);
    
    // Update cart when opening the cart sidebar
    document.getElementById('sepetOffcanvas').addEventListener('show.bs.offcanvas', updateCartDisplay);
}

// Add a product to cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.urun_id === productId);
    
    if (existingItem) {
        existingItem.miktar++;
        existingItem.toplam_fiyat = existingItem.miktar * existingItem.birim_fiyat;
    } else {
        cart.push({
            urun_id: productId,
            urun_adi: product.ad,
            miktar: 1,
            birim_fiyat: parseFloat(product.fiyat),
            toplam_fiyat: parseFloat(product.fiyat),
            durum: 'beklemede'
        });
    }
    
    // Update cart badge
    updateCartBadge();
    
    // Show toast notification
    showToast(`${product.ad} sepete eklendi`);
}

// Update cart badge count
function updateCartBadge() {
    const totalItems = cart.reduce((total, item) => total + item.miktar, 0);
    document.getElementById('sepet-badge').textContent = totalItems;
}

// Update cart display
function updateCartDisplay() {
    const sepetItemsEl = document.getElementById('sepet-items');
    const sepetTotalEl = document.getElementById('sepet-toplam');
    
    if (cart.length === 0) {
        sepetItemsEl.innerHTML = `<p class="text-center text-muted">Sepetiniz boş</p>`;
        sepetTotalEl.textContent = formatCurrency(0);
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.birim_fiyat * item.miktar;
        total += itemTotal;
        
        html += `
            <div class="sepet-item mb-3 pb-3 border-bottom">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <h6 class="mb-0">${item.urun_adi}</h6>
                        <small class="text-muted">${formatCurrency(item.birim_fiyat)} × ${item.miktar}</small>
                    </div>
                    <div class="d-flex align-items-center">
                        <button class="btn btn-sm btn-outline-secondary decrease-quantity" data-index="${index}">-</button>
                        <span class="mx-2">${item.miktar}</span>
                        <button class="btn btn-sm btn-outline-secondary increase-quantity" data-index="${index}">+</button>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-bold">${formatCurrency(itemTotal)}</span>
                    <button class="btn btn-sm btn-outline-danger remove-from-cart" data-index="${index}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    sepetItemsEl.innerHTML = html;
    sepetTotalEl.textContent = formatCurrency(total);
    
    // Add event listeners for cart item buttons
    document.querySelectorAll('.decrease-quantity').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            updateCartItemQuantity(index, -1);
        });
    });
    
    document.querySelectorAll('.increase-quantity').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            updateCartItemQuantity(index, 1);
        });
    });
    
    document.querySelectorAll('.remove-from-cart').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeFromCart(index);
        });
    });
}

// Update cart item quantity
function updateCartItemQuantity(index, change) {
    if (index < 0 || index >= cart.length) return;
    
    cart[index].miktar += change;
    
    if (cart[index].miktar <= 0) {
        removeFromCart(index);
    } else {
        // Update total price for this item
        cart[index].toplam_fiyat = cart[index].miktar * cart[index].birim_fiyat;
        updateCartBadge();
        updateCartDisplay();
    }
}

// Remove item from cart
function removeFromCart(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    updateCartBadge();
    updateCartDisplay();
}

// Calculate total order amount
function calculateOrderTotal() {
    return cart.reduce((total, item) => total + item.toplam_fiyat, 0);
}

// Submit order to Supabase
async function submitOrder() {
    if (cart.length === 0) {
        alert('Lütfen sipariş vermek için sepete ürün ekleyin.');
        return;
    }
    
    try {
        // Create main order
        const orderTotal = calculateOrderTotal();
        
        const { data: orderData, error: orderError } = await supabase
            .from('siparisler')
            .insert({
                masa_id: tableData.id,
                masa_no: tableNumber,
                durum: 'beklemede',
                toplam_fiyat: orderTotal,
                siparis_notu: '',
                urunler: cart // Store a copy of the cart in the order's urunler field
            })
            .select()
            .single();
            
        if (orderError) {
            console.error('Sipariş oluşturulurken hata:', orderError);
            alert('Sipariş oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
            return;
        }
        
        // Create order items
        const orderItems = cart.map(item => ({
            siparis_id: orderData.id,
            urun_id: item.urun_id,
            urun_adi: item.urun_adi,
            miktar: item.miktar,
            birim_fiyat: item.birim_fiyat,
            toplam_fiyat: item.toplam_fiyat,
            durum: 'beklemede'
        }));
        
        const { error: itemsError } = await supabase
            .from('siparis_kalemleri')
            .insert(orderItems);
            
        if (itemsError) {
            console.error('Sipariş kalemleri oluşturulurken hata:', itemsError);
            // Even if there's an error with items, we created the main order, so continue
        }
        
        // Update table with order ID
        await supabase
            .from('masalar')
            .update({ 
                durum: 'dolu',
                siparis_id: orderData.id,
                toplam_tutar: orderTotal
            })
            .eq('id', tableData.id);
        
        // Clear the cart
        cart = [];
        updateCartBadge();
        
        // Close the cart offcanvas
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('sepetOffcanvas'));
        bsOffcanvas.hide();
        
        // Show confirmation modal
        const modal = new bootstrap.Modal(document.getElementById('siparisOnayModal'));
        modal.show();
        
    } catch (error) {
        console.error('Sipariş gönderilirken hata:', error);
        alert('Sipariş işlemi sırasında bir hata oluştu.');
    }
}

// Show toast notification
function showToast(message) {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create unique ID for this toast
    const toastId = 'toast-' + Date.now();
    
    // Create toast HTML
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <strong class="me-auto">Bildirim</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    // Add toast to container
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 2000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        this.remove();
    });
}

// Setup order subscription for real-time updates
function setupOrderSubscription() {
    // Subscribe to orders for this table
    orderSubscription = subscribeToOrders(tableNumber, (payload) => {
        const order = payload.new;
        
        // If there's an active order for this table, update UI
        if (order && order.masa_no === tableNumber) {
            updateOrderStatus(order);
        }
    });
}

// Update order status display
function updateOrderStatus(order) {
    const statusEl = document.getElementById('siparis-durumu');
    let statusText = '';
    let statusClass = 'alert-info';
    
    switch (order.durum) {
        case 'beklemede':
            statusText = 'Siparişiniz alındı, beklemede.';
            break;
        case 'hazirlaniyor':
            statusText = 'Siparişiniz hazırlanıyor...';
            break;
        case 'tamamlandi':
            statusText = 'Siparişiniz hazır, servis ediliyor.';
            statusClass = 'alert-success';
            break;
        case 'teslim_edildi':
            statusText = 'Siparişiniz teslim edildi.';
            statusClass = 'alert-secondary';
            break;
        case 'servis_edildi':
            statusText = 'Afiyet olsun!';
            statusClass = 'alert-secondary';
            break;
    }
    
    if (statusText) {
        statusEl.textContent = statusText;
        statusEl.className = `alert ${statusClass}`;
        statusEl.style.display = 'block';
    }
} 
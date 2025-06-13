// Supabase configuration
const SUPABASE_URL = 'https://egcklzfiyxxnvyxwoowq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY2tsemZpeXh4bnZ5eHdvb3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTg0MDY2MTksImV4cCI6MjAzMzk4MjYxOX0.96UQT6QQTo0P3HwsMpkgnzUt6vYpA-0iHslSICWv9Dk';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if connection is established
async function checkConnection() {
    try {
        const { data, error } = await supabase.from('urunler').select('id').limit(1);
        if (error) {
            console.error('Supabase bağlantı hatası:', error);
            return false;
        }
        console.log('Supabase bağlantısı başarılı!');
        return true;
    } catch (error) {
        console.error('Supabase bağlantı hatası:', error);
        return false;
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(amount);
}

// Get URL parameters
function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get table number from URL
function getTableNumber() {
    const tableNumber = getUrlParam('masa');
    return tableNumber ? parseInt(tableNumber) : null;
}

// Check if table exists and is available
async function checkTableAvailability(tableNumber) {
    if (!tableNumber) return false;
    
    try {
        const { data, error } = await supabase
            .from('masalar')
            .select('*')
            .eq('masa_no', tableNumber)
            .single();
            
        if (error) {
            console.error('Masa bilgisi alınamadı:', error);
            return false;
        }
        
        return data;
    } catch (error) {
        console.error('Masa kontrol hatası:', error);
        return false;
    }
}

// Initialize real-time subscriptions for orders
function subscribeToOrders(tableNumber, callback) {
    return supabase
        .channel('orders-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'siparisler',
                filter: tableNumber ? `masa_no=eq.${tableNumber}` : undefined
            },
            (payload) => callback(payload)
        )
        .subscribe();
}

// Initialize real-time subscriptions for tables
function subscribeToTables(callback) {
    return supabase
        .channel('tables-channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'masalar'
            },
            (payload) => callback(payload)
        )
        .subscribe();
} 
// =====================================================================
// 1. INISIALISASI FIREBASE
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyAOX0KrT92D1yvY2x6zgWKhQzNJC_HU8yE",
  authDomain: "ggwash-system1.firebaseapp.com",
  projectId: "ggwash-system1",
  storageBucket: "ggwash-system1.firebasestorage.app",
  messagingSenderId: "991027873318",
  appId: "1:991027873318:web:f6866f3e8014a643e488e7",
  measurementId: "G-57G9FG6L1C"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();
const auth = firebase.auth();

// =====================================================================
// 2. STATE MANAGEMENT LOKAL & GRAFIK
// =====================================================================
let keuangan = { pemHarian: 0, pengHarian: 0, pemBulanan: 0, pengBulanan: 0 };
let stok = { sabun: 0, semir: 0, microfiber: 0, sikat: 0, kuas: 0 };
let riwayatTransaksi = [];
let chartData = {
    labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Hari Ini'],
    pemasukan: [0, 0, 0, 0, 0, 0, 0], pengeluaran: [0, 0, 0, 0, 0, 0, 0]
};

// =====================================================================
// 3. FUNGSI SINKRONISASI DATA DARI FIRESTORE (PULL DATA)
// =====================================================================
async function loadDataDariFirebase() {
    try {
        // A. Tarik Data Keuangan
        const dataUangRef = await db.collection('keuangan').doc('summary').get();
        if (dataUangRef.exists) {
            const d = dataUangRef.data();
            keuangan.pemHarian = d.pemHarian || 0; keuangan.pengHarian = d.pengHarian || 0;
            keuangan.pemBulanan = d.pemBulanan || 0; keuangan.pengBulanan = d.pengBulanan || 0;
        }

        // B. Tarik Data Stok
        const stokSnap = await db.collection('stok').get();
        stokSnap.forEach(doc => { if (stok[doc.id] !== undefined) stok[doc.id] = doc.data().jumlah; });

        // C. Tarik Riwayat Transaksi
        const riwayatSnap = await db.collection('riwayat_transaksi').orderBy('timestamp', 'desc').get();
        riwayatTransaksi = [];
        riwayatSnap.forEach(doc => {
            const item = doc.data();
            riwayatTransaksi.push({
                id: doc.id, waktu: item.waktu, pelanggan: item.pelanggan,
                layananTeks: item.layananTeks, harga: item.harga, metode: item.metode
            });
        });
        
        updateDashboardUI();
    } catch (err) { console.error('Gagal menarik data:', err); }
}

// PROTEKSI SESI FIREBASE
document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'login.html'; // Kembali ke halaman login jika belum masuk
        } else {
            initChart(); loadDataDariFirebase();
        }
    });
});

// =====================================================================
// 4. LOGIKA NAVIGASI MENU (SaaS UI)
// =====================================================================
const navButtons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.content-section');
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const targetSection = document.getElementById(btn.dataset.target);
        if (targetSection) targetSection.classList.add('active');
    });
});

const innerNavs = document.querySelectorAll('.inner-tab-btn');
const innerContents = document.querySelectorAll('.inner-content');
innerNavs.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        innerNavs.forEach(b => b.classList.remove('active'));
        innerContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetForm = document.getElementById(btn.dataset.inner);
        if (targetForm) targetForm.classList.add('active');
    });
});

// =====================================================================
// 5. UTILITAS & FORMAT UI
// =====================================================================
const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
function formatRupiahMurni(angka, prefix) { let number_string = angka.replace(/[^,\d]/g, '').toString(), split = number_string.split('Sample'), sisa = split[0].length % 3, rupiah = split[0].substr(0, sisa), ribuan = split[0].substr(sisa).match(/\d{3}/gi); if (ribuan) { let separator = sisa ? '.' : ''; rupiah += separator + ribuan.join('.'); } return prefix == undefined ? rupiah : (rupiah ? 'Rp ' + rupiah : ''); }
function bersihkanAngka(rupiahString) { return parseInt(rupiahString.replace(/[^0-9]/g, '')) || 0; }
document.querySelectorAll('.input-rupiah').forEach(input => { input.addEventListener('keyup', function(e) { this.value = formatRupiahMurni(this.value, 'Rp '); }); });

let dailyChart;
function initChart() {
    const canvasElement = document.getElementById('dailyChart');
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');
    dailyChart = new Chart(ctx, { type: 'bar', data: { labels: chartData.labels, datasets: [{ label: 'Pemasukan', data: chartData.pemasukan, backgroundColor: '#10b981', borderRadius: 6 }, { label: 'Pengeluaran', data: chartData.pengeluaran, backgroundColor: '#ef4444', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { borderDash: [4, 4] } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top', labels: { font: { family: 'Inter', size: 12 } } } } } });
}

function safeSetText(id, text) { const element = document.getElementById(id); if (element) { element.textContent = text; } }

function updateHistoryTableUI() {
    const tbody = document.getElementById('tableRiwayatBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (riwayatTransaksi.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state-wrapper"><i class="fa-solid fa-folder-open"></i><p>Belum ada data transaksi yang tercatat.</p></div></td></tr>`;
        return;
    }

    riwayatTransaksi.forEach((item, index) => {
        const tr = document.createElement('tr');
        // PENTING: Firebase menggunakan String ID, sehingga parameter fungsi diapit tanda kutip ('${item.id}')
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.waktu}</td>
            <td><strong>${item.pelanggan}</strong></td>
            <td><span class="service-tag">${item.layananTeks}</span></td>
            <td class="text-green" style="font-weight:700;">${formatRupiah(item.harga)}</td>
            <td><span style="text-transform: uppercase; font-size:0.85rem; font-weight:600; padding:4px 10px; background:#e0f2fe; color:#0284c7; border-radius:99px;">${item.metode}</span></td>
            <td style="text-align: center;">
                <button class="btn-delete-row" onclick="cetakStruk('${item.id}')" title="Cetak Struk"><i class="fa-solid fa-print"></i></button>
                <button class="btn-delete-row" onclick="hapusBarisTransaksi('${item.id}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateDashboardUI() {
    safeSetText('pemHarian', formatRupiah(keuangan.pemHarian)); safeSetText('pengHarian', formatRupiah(keuangan.pengHarian)); safeSetText('labaHarian', formatRupiah(keuangan.pemHarian - keuangan.pengHarian));
    safeSetText('pemBulanan', formatRupiah(keuangan.pemBulanan)); safeSetText('pengBulanan', formatRupiah(keuangan.pengBulanan)); safeSetText('saldoAset', formatRupiah(keuangan.pemBulanan - keuangan.pengBulanan));
    safeSetText('stokSabun', stok.sabun); safeSetText('stokSemir', stok.semir); safeSetText('stokMicrofiber', stok.microfiber); safeSetText('stokSikat', stok.sikat); safeSetText('stokKuas', stok.kuas);

    const progressSabun = document.querySelector('.progress-fill.bg-blue'), progressSemir = document.querySelector('.progress-fill.bg-purple');
    if (progressSabun) { let p = (stok.sabun / 10000) * 100; progressSabun.style.width = `${p > 100 ? 100 : p}%`; }
    if (progressSemir) { let p = (stok.semir / 5000) * 100; progressSemir.style.width = `${p > 100 ? 100 : p}%`; }

    if (dailyChart) { chartData.pemasukan[6] = keuangan.pemHarian; chartData.pengeluaran[6] = keuangan.pengHarian; dailyChart.update(); }
    updateHistoryTableUI();
}

// =====================================================================
// 6. PUSH DATA: TRANSAKSI & ARUS KAS (FIREBASE)
// =====================================================================
const formTransaksi = document.getElementById('formTransaksi');
if (formTransaksi) {
    formTransaksi.addEventListener('submit', async (e) => {
        e.preventDefault();
        const layananTerpilih = document.querySelector('input[name="layanan"]:checked');
        if (!layananTerpilih) return Toast.fire({ icon: 'warning', title: 'Silakan pilih jenis layanan!' });

        const harga = parseInt(layananTerpilih.dataset.price), pakaiSabun = parseInt(layananTerpilih.dataset.sabun);
        const namaCust = document.getElementById('namaPelanggan').value || 'Pelanggan Umum', metode = document.getElementById('metodeBayar').value;
        const layananNama = layananTerpilih.value === 'kilat' ? 'Cuci Kilat' : layananTerpilih.value === 'bersih' ? 'Cuci Bersih' : 'Full Services';
        const waktuTeks = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) + ' - ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        Swal.showLoading();
        try {
            // Simpan Transaksi (Firebase otomatis buatkan ID)
            const docRef = await db.collection('riwayat_transaksi').add({
                waktu: waktuTeks, pelanggan: namaCust, layananTeks: layananNama, harga: harga, metode: metode,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            keuangan.pemHarian += harga; keuangan.pemBulanan += harga;
            stok.sabun -= pakaiSabun; stok.semir -= 10;
            riwayatTransaksi.unshift({ id: docRef.id, waktu: waktuTeks, pelanggan: namaCust, layananTeks: layananNama, harga: harga, metode: metode });

            // Update menggunakan merge:true agar fleksibel
            await db.collection('keuangan').doc('summary').set({ pemHarian: keuangan.pemHarian, pemBulanan: keuangan.pemBulanan }, { merge: true });
            await db.collection('stok').doc('sabun').set({ jumlah: stok.sabun }, { merge: true });
            await db.collection('stok').doc('semir').set({ jumlah: stok.semir }, { merge: true });

            Swal.close(); updateDashboardUI(); e.target.reset(); Toast.fire({ icon: 'success', title: 'Transaksi disimpan' });
        } catch (error) { Swal.close(); Toast.fire({ icon: 'error', title: 'Gagal ke Server' }); console.error(error); }
    });
}

const formPengeluaran = document.getElementById('formPengeluaran');
if (formPengeluaran) {
    formPengeluaran.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nominal = bersihkanAngka(document.getElementById('nomPengeluaran').value), saldoSaatIni = keuangan.pemBulanan - keuangan.pengBulanan;
        if (nominal > saldoSaatIni) return Swal.fire({ icon: 'error', title: 'Saldo Tidak Cukup!', text: `Kas tersisa ${formatRupiah(saldoSaatIni)}.` });

        keuangan.pengHarian += nominal; keuangan.pengBulanan += nominal;
        await db.collection('keuangan').doc('summary').set({ pengHarian: keuangan.pengHarian, pengBulanan: keuangan.pengBulanan }, { merge: true });
        updateDashboardUI(); e.target.reset(); Toast.fire({ icon: 'success', title: 'Pengeluaran dicatat' });
    });
}

const formPemasukan = document.getElementById('formPemasukan');
if (formPemasukan) {
    formPemasukan.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nominal = bersihkanAngka(document.getElementById('nomPemasukan').value);
        keuangan.pemHarian += nominal; keuangan.pemBulanan += nominal;
        await db.collection('keuangan').doc('summary').set({ pemHarian: keuangan.pemHarian, pemBulanan: keuangan.pemBulanan }, { merge: true });
        updateDashboardUI(); e.target.reset(); Toast.fire({ icon: 'success', title: 'Pemasukan ditambah' });
    });
}

const formStok = document.getElementById('formStok');
if (formStok) {
    formStok.addEventListener('submit', async (e) => {
        e.preventDefault();
        const item = document.getElementById('itemStok').value, aksi = document.getElementById('aksiStok').value, jumlah = parseInt(document.getElementById('jumlahStok').value);
        const namaItem = document.querySelector(`#itemStok option[value="${item}"]`).textContent;

        if (aksi === 'tambah') { stok[item] += jumlah; } 
        else {
            if (jumlah > stok[item]) return Swal.fire({ icon: 'error', title: 'Stok Kurang!', text: `Sisa ${stok[item]}.` });
            stok[item] -= jumlah;
        }

        await db.collection('stok').doc(item).set({ jumlah: stok[item] }, { merge: true });
        updateDashboardUI(); e.target.reset(); Toast.fire({ icon: 'success', title: `${namaItem} diperbarui` });
    });
}

// =====================================================================
// 7. FUNGSI HAPUS DATA & CLEAR ALL
// =====================================================================
window.hapusBarisTransaksi = async function(id) {
    Swal.fire({ title: 'Hapus Transaksi?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.showLoading();
            const dataDitemukan = riwayatTransaksi.find(item => item.id === id);
            if (dataDitemukan) {
                keuangan.pemHarian -= dataDitemukan.harga; keuangan.pemBulanan -= dataDitemukan.harga;
                await db.collection('riwayat_transaksi').doc(id).delete();
                await db.collection('keuangan').doc('summary').set({ pemHarian: keuangan.pemHarian, pemBulanan: keuangan.pemBulanan }, { merge: true });
            }
            riwayatTransaksi = riwayatTransaksi.filter(item => item.id !== id);
            Swal.close(); updateDashboardUI(); Toast.fire({ icon: 'success', title: 'Transaksi dihapus' });
        }
    });
};

const btnClearAll = document.getElementById('btnClearAll');
if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
        if (riwayatTransaksi.length === 0) return Toast.fire({ icon: 'info', title: 'Kosong' });
        Swal.fire({ title: 'Kosongkan Data?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626' }).then(async (result) => {
            if (result.isConfirmed) {
                Swal.showLoading();
                const snapshot = await db.collection('riwayat_transaksi').get();
                const batch = db.batch();
                snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
                await batch.commit();

                keuangan.pemHarian = 0;
                await db.collection('keuangan').doc('summary').set({ pemHarian: 0 }, { merge: true });
                riwayatTransaksi = [];
                Swal.close(); updateDashboardUI(); Swal.fire('Terhapus!', 'Semua riwayat bersih.', 'success');
            }
        });
    });
}

// =====================================================================
// 8. FITUR EKSPOR, CETAK STRUK, PENCARIAN, NOTIFIKASI & DARK MODE
// =====================================================================
window.cetakStruk = function(id) {
    const t = riwayatTransaksi.find(x => x.id === id);
    if (!t) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Struk GG Steam</title></head><body style="font-family: monospace; width: 200px;"><div style="text-align: center;"><h3>GG STEAM</h3><p>${t.waktu}</p><hr></div><p>Jasa: ${t.layananTeks}</p><p>Cust: ${t.pelanggan}</p><hr><p><b>TOTAL: ${formatRupiah(t.harga)}</b></p><p>Metode: ${t.metode.toUpperCase()}</p><div style="text-align: center;"><p>Terima Kasih!</p></div></body></html>`);
    printWindow.document.close(); printWindow.print();
};

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const keyword = e.target.value.toLowerCase();
        if(keyword.length > 0) { const t = document.querySelector('[data-target="history"]'); if(t && !t.classList.contains('active')) t.click(); }
        const tbody = document.getElementById('tableRiwayatBody');
        if (!tbody) return;
        const fData = riwayatTransaksi.filter(i => i.pelanggan.toLowerCase().includes(keyword) || i.layananTeks.toLowerCase().includes(keyword) || i.waktu.toLowerCase().includes(keyword));
        tbody.innerHTML = '';
        if (fData.length === 0) return tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state-wrapper"><i class="fa-solid fa-folder-open"></i><p>Pencarian "${keyword}" tidak ditemukan.</p></div></td></tr>`;
        
        fData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${index + 1}</td><td>${item.waktu}</td><td><strong>${item.pelanggan}</strong></td><td><span class="service-tag">${item.layananTeks}</span></td><td class="text-green" style="font-weight:700;">${formatRupiah(item.harga)}</td><td><span style="text-transform: uppercase; font-size:0.85rem; font-weight:600; padding:4px 10px; background:#e0f2fe; color:#0284c7; border-radius:99px;">${item.metode}</span></td><td style="text-align: center;"><button class="btn-delete-row" onclick="cetakStruk('${item.id}')" title="Cetak"><i class="fa-solid fa-print"></i></button><button class="btn-delete-row" onclick="hapusBarisTransaksi('${item.id}')" title="Hapus"><i class="fa-solid fa-trash-can"></i></button></td>`;
            tbody.appendChild(tr);
        });
        if(keyword.length === 0) updateHistoryTableUI();
    });
}

const btnNotif = document.getElementById('btnNotif'), notifPulse = document.getElementById('notifPulse');
if (btnNotif) {
    btnNotif.addEventListener('click', () => {
        if(notifPulse) notifPulse.style.display = 'none';
        let pesan = '<div style="text-align:left; font-size:0.95rem; font-family: Inter, sans-serif;">', ada = false;
        if (stok.sabun < 1000) { pesan += '<p style="color:#ef4444; margin-bottom:12px; padding:10px; background:#fee2e2; border-radius:8px;"><i class="fa-solid fa-triangle-exclamation"></i> <b>Stok Sabun Kritis:</b> Kurang dari 1000 ml!</p>'; ada = true; }
        if (stok.semir < 500) { pesan += '<p style="color:#f59e0b; margin-bottom:12px; padding:10px; background:#fef3c7; border-radius:8px;"><i class="fa-solid fa-circle-exclamation"></i> <b>Stok Semir Menipis:</b> Kurang dari 500 ml!</p>'; ada = true; }
        if (!ada) pesan += '<p style="color:#10b981; padding:10px; background:#dcfce7; border-radius:8px;"><i class="fa-solid fa-circle-check"></i> <b>Sistem Aman:</b> Metrik keuangan dan stok stabil.</p>';
        Swal.fire({ title: 'Pusat Notifikasi', html: pesan + '</div>', icon: ada ? 'warning' : 'info', confirmButtonColor: '#0ea5e9', confirmButtonText: 'Tutup', width: '400px' });
    });
}

const btnTheme = document.getElementById('btnTheme'), themeIcon = document.getElementById('themeIcon');
if (localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun'); }
if (btnTheme) {
    btnTheme.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) { themeIcon.classList.replace('fa-moon', 'fa-sun'); localStorage.setItem('theme', 'dark'); }
        else { themeIcon.classList.replace('fa-sun', 'fa-moon'); localStorage.setItem('theme', 'light'); }
    });
}

const btnExportExcel = document.getElementById('btnExportExcel');
if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
        if (riwayatTransaksi.length === 0) return Toast.fire({ icon: 'warning', title: 'Tidak ada data!' });
        const dataExcel = riwayatTransaksi.map((item, index) => ({ "No": index + 1, "Waktu": item.waktu, "Nama": item.pelanggan, "Jasa": item.layananTeks, "Bayar": item.harga, "Metode": item.metode.toUpperCase() }));
        const ws = XLSX.utils.json_to_sheet(dataExcel), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Laporan"); XLSX.writeFile(wb, `Laporan_GG_Steam_${new Date().toISOString().slice(0,10)}.xlsx`);
    });
}

const btnExportPDF = document.getElementById('btnExportPDF');
if (btnExportPDF) {
    btnExportPDF.addEventListener('click', () => {
        if (riwayatTransaksi.length === 0) return Toast.fire({ icon: 'warning', title: 'Tidak ada data!' });
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.setFont("Helvetica", "bold"); doc.setFontSize(18); doc.text("LAPORAN RIWAYAT TRANSAKSI", 14, 20);
        doc.setFontSize(11); doc.setFont("Helvetica", "normal"); doc.text(`GG Steam Enterprise Edition | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);
        const barisPDF = riwayatTransaksi.map((item, i) => [i + 1, item.waktu, item.pelanggan, item.layananTeks, `Rp ${item.harga.toLocaleString('id-ID')}`, item.metode.toUpperCase()]);
        doc.autoTable({ head: [['No', 'Waktu', 'Nama', 'Jasa', 'Total', 'Metode']], body: barisPDF, startY: 35, theme: 'striped', headStyles: { fillColor: [14, 165, 233] }, styles: { fontSize: 9 } });
        doc.save(`Laporan_GG_Steam_${new Date().toISOString().slice(0,10)}.pdf`);
    });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        Swal.fire({ title: 'Akhiri Sesi?', icon: 'question', showCancelButton: true, confirmButtonColor: '#0ea5e9', confirmButtonText: 'Keluar' }).then(async (r) => { 
            if (r.isConfirmed) {
                await auth.signOut(); // Akhiri sesi di Firebase
            }
        });
    });
}
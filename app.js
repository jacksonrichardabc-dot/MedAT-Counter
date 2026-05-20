import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCALFcPOSwMVvVFWj45MULJlaFOc8WnGig",
  authDomain: "medat-counter.firebaseapp.com",
  projectId: "medat-counter",
  storageBucket: "medat-counter.firebasestorage.app",
  messagingSenderId: "653912824597",
  appId: "1:653912824597:web:e01fd98b00496747a0271c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- EXAM STRUCTURE WITH EMOJIS ---
const SINAV_YAPISI = {
    "BMS": { "Biologie 🧬": 40, "Chemie 🧪": 24, "Physik ⚛️": 18, "Mathe 🧮": 12 },
    "TV": { "TV 📖": 12 },
    "KFF": { "Figuren zusammensetzen 🧩": 15, "Zahlenfolgen 🔢": 10, "Wortflüssigkeit 🔠": 15, "GD Abrufphase 🧠": 25, "Implikationen 💡": 10 },
    "SEK": { "Emotionen regulieren 😌": 12, "Emotionen erkennen 🎭": 14, "Sociales Entscheiden 🤝": 14 }
};

// --- PERCENTAGE STRUCTURE ---
const SINAV_YUZDELERI = {
    "BMS": { "Biologie 🧬": 17, "Chemie 🧪": 10, "Physik ⚛️": 8, "Mathe 🧮": 5 },
    "TV": { "TV 📖": 10 },
    "KFF": { "Figuren zusammensetzen 🧩": 8, "Zahlenfolgen 🔢": 5, "Wortflüssigkeit 🔠": 8, "GD Abrufphase 🧠": 13, "Implikationen 💡": 5 },
    "SEK": { "Emotionen regulieren 😌": 10/3, "Emotionen erkennen 🎭": 10/3, "Sociales Entscheiden 🤝": 10/3 }
};

// DOM Nodes
const authContainer = document.getElementById('authContainer'), appContainer = document.getElementById('appContainer'), welcomeText = document.getElementById('welcomeText');
const homeView = document.getElementById('homeView'), dataView = document.getElementById('dataView'), graphView = document.getElementById('graphView'), percentView = document.getElementById('percentView');
const reader1View = document.getElementById('reader1View'), reader2View = document.getElementById('reader2View');

const categoryInput = document.getElementById('categoryInput'), subCategoryInput = document.getElementById('subCategoryInput'), tableBody = document.getElementById('tableBody');
const graphCatSelect = document.getElementById('graphCatSelect'), graphSubSelect = document.getElementById('graphSubSelect');
const percentCatSelect = document.getElementById('percentCatSelect'), percentSubSelect = document.getElementById('percentSubSelect');

let currentUser = null, myChartInstance = null, percentChartInstance = null, isLoginMode = true, tumVeriler = [], kütüphaneMetinleri = []; 

function formatliTarih(tarihString) {
    const aylar = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (!tarihString) return "";
    const parcalar = tarihString.split('-'); 
    if (parcalar.length !== 3) return tarihString;
    return `${parseInt(parcalar[2], 10)} ${aylar[parseInt(parcalar[1], 10) - 1]}`;
}

function setTodayDate() {
    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        const today = new Date();
        dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; 
    }
}

function populateSubCategories(catValue, targetSelect, showAllOption = false) {
    targetSelect.innerHTML = showAllOption ? '<option value="TUM">Total of All Sections</option>' : '<option value="" disabled selected>Select a Section</option>';
    if (catValue === 'TUM' || !SINAV_YAPISI[catValue]) { targetSelect.disabled = true; return; }
    targetSelect.disabled = false;
    Object.keys(SINAV_YAPISI[catValue]).forEach(bolum => {
        targetSelect.innerHTML += `<option value="${bolum}">${bolum} (Max: ${SINAV_YAPISI[catValue][bolum]})</option>`;
    });
}

categoryInput.addEventListener('change', (e) => populateSubCategories(e.target.value, subCategoryInput, false));
graphCatSelect.addEventListener('change', (e) => { populateSubCategories(e.target.value, graphSubSelect, true); updateGraph(); });
graphSubSelect.addEventListener('change', () => updateGraph());
percentCatSelect.addEventListener('change', (e) => { populateSubCategories(e.target.value, percentSubSelect, true); updatePercentGraph(); });
percentSubSelect.addEventListener('change', () => updatePercentGraph());

function showView(viewName) {
    [homeView, dataView, graphView, percentView, reader1View, reader2View, testView].forEach(v => v.style.display = 'none');
    document.getElementById('homeBtn').style.display = 'block';
    
    pauseReader1(); pauseReader2();

    if (viewName === 'home') { homeView.style.display = 'flex'; document.getElementById('homeBtn').style.display = 'none'; }
    else if (viewName === 'data') { dataView.style.display = 'block'; setTodayDate(); renderTable(); }
    else if (viewName === 'graph') { graphView.style.display = 'block'; updateGraph(); }
    else if (viewName === 'percent') { percentView.style.display = 'block'; updatePercentGraph(); }
    else if (viewName === 'reader1') { reader1View.style.display = 'block'; }
    else if (viewName === 'reader2') { reader2View.style.display = 'block'; }
    else if (viewName === 'test') { testView.style.display = 'block'; }
}
document.getElementById('navToDataBtn').addEventListener('click', () => showView('data'));
document.getElementById('navToGraphBtn').addEventListener('click', () => showView('graph'));
document.getElementById('navToPercentBtn').addEventListener('click', () => showView('percent'));
document.getElementById('navToReader1Btn').addEventListener('click', () => showView('reader1'));
document.getElementById('navToReader2Btn').addEventListener('click', () => showView('reader2'));
document.getElementById('homeBtn').addEventListener('click', () => showView('home'));

document.getElementById('switchAuth').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').innerText = isLoginMode ? "🔒 Login" : "📝 Sign Up";
    document.getElementById('authBtn').innerText = isLoginMode ? "Login" : "Sign Up";
    document.getElementById('toggleAuthText').innerHTML = isLoginMode ? "Don't have an account? <span id='switchAuth'>Sign Up</span>" : "Already have an account? <span id='switchAuth'>Login</span>";
    document.getElementById('switchAuth').addEventListener('click', arguments.callee);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        welcomeText.innerText = `👋 Hello, ${user.email.split('@')[0].toUpperCase()}!`;
        authContainer.style.display = "none"; appContainer.style.display = "block";
        showView('home'); 
        fetchDataFromFirebase();
        fetchLibraryFromFirebase(); // Login olunca metinleri de indir
    } else { currentUser = null; authContainer.style.display = "block"; appContainer.style.display = "none"; }
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value, password = document.getElementById('authPassword').value;
    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, password);
        else await createUserWithEmailAndPassword(auth, email, password);
        e.target.reset();
    } catch (error) { alert("Error: " + error.message); }
});
document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

// DATA ENTRY
document.getElementById('studyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const catVal = categoryInput.value, subCatVal = subCategoryInput.value, questionVal = Number(document.getElementById('questionInput').value);
    const maxVal = SINAV_YAPISI[catVal][subCatVal];
    
    if (questionVal > maxVal) {
        alert(`❌ ERROR: You entered a value higher than the maximum!\nYou can enter up to ${maxVal} questions for ${subCatVal}.`);
        return; 
    }

    try {
        await addDoc(collection(db, "calismalar"), {
            userId: currentUser.uid,
            tarih: document.getElementById('dateInput').value,
            kategori: catVal, bolum: subCatVal, soru: questionVal,
            eklenmeZamani: new Date().getTime() 
        });
        document.getElementById('studyForm').reset();
        subCategoryInput.innerHTML = '<option value="" disabled selected>Select a Category First</option>';
        subCategoryInput.disabled = true;
        setTodayDate(); await fetchDataFromFirebase(); renderTable();
    } catch (error) { alert("Failed to add data!"); }
});

window.veriSil = async function(docId) {
    if (confirm("Are you sure you want to completely delete this data?")) {
        try {
            await deleteDoc(doc(db, "calismalar", docId)); await fetchDataFromFirebase(); 
            if (dataView.style.display === 'block') renderTable(); 
            if (graphView.style.display === 'block') updateGraph(); 
            if (percentView.style.display === 'block') updatePercentGraph(); 
        } catch (error) { alert("An error occurred while deleting!"); }
    }
}

async function fetchDataFromFirebase() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, "calismalar"), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        tumVeriler = [];
        querySnapshot.forEach((doc) => tumVeriler.push({ id: doc.id, ...doc.data() }));
        tumVeriler.sort((a, b) => new Date(a.tarih) - new Date(b.tarih) || a.eklenmeZamani - b.eklenmeZamani);
    } catch (error) { console.error(error); }
}

function renderTable() {
    tableBody.innerHTML = "";
    const grupluVeriler = {};
    tumVeriler.forEach(veri => {
        if (!grupluVeriler[veri.tarih]) grupluVeriler[veri.tarih] = {};
        if (!grupluVeriler[veri.tarih][veri.kategori]) grupluVeriler[veri.tarih][veri.kategori] = [];
        grupluVeriler[veri.tarih][veri.kategori].push(veri);
    });

    const siraliTarihler = Object.keys(grupluVeriler).sort((a,b) => new Date(b) - new Date(a));

    siraliTarihler.forEach(tarih => {
        const thRow = document.createElement('tr');
        thRow.innerHTML = `<td colspan="4" style="background: linear-gradient(90deg, #2c3e50, #34495e); color: white; font-size: 16px; padding: 14px; text-transform: uppercase; letter-spacing: 2px; text-align: center; border-radius: 6px;">🗓️ ${formatliTarih(tarih)}</td>`;
        tableBody.appendChild(thRow);

        Object.keys(grupluVeriler[tarih]).forEach(kat => {
            const catRow = document.createElement('tr');
            catRow.className = "cat-header";
            catRow.innerHTML = `<td colspan="4">🔹 ${kat} Category</td>`; 
            tableBody.appendChild(catRow);

            const bölümSayilari = {};
            grupluVeriler[tarih][kat].forEach(d => { bölümSayilari[d.bolum] = (bölümSayilari[d.bolum] || 0) + 1; });

            const subCatSayaci = {};
            grupluVeriler[tarih][kat].forEach(data => {
                const tr = document.createElement('tr');
                
                let maksSoru = "?";
                let dersinSinavYuzdesi = 0;
                let hesaplananYuzde = "0.0";

                if (SINAV_YAPISI[data.kategori] && SINAV_YAPISI[data.kategori][data.bolum]) {
                    maksSoru = SINAV_YAPISI[data.kategori][data.bolum];
                    dersinSinavYuzdesi = SINAV_YUZDELERI[data.kategori][data.bolum];
                    hesaplananYuzde = ((data.soru / maksSoru) * dersinSinavYuzdesi).toFixed(1);
                }

                let denemeBadge = "";
                if (bölümSayilari[data.bolum] > 1) { 
                    if (!subCatSayaci[data.bolum]) subCatSayaci[data.bolum] = 0;
                    subCatSayaci[data.bolum]++;
                    denemeBadge = `<span style="font-size:12px; color:#777; margin-left:5px;">(Attempt ${subCatSayaci[data.bolum]})</span>`;
                }

                const gosterilecekMaxYuzde = dersinSinavYuzdesi % 1 === 0 ? dersinSinavYuzdesi : dersinSinavYuzdesi.toFixed(1);

                tr.innerHTML = `
                    <td style="padding-left: 20px;">${data.bolum} ${denemeBadge}</td>
                    <td><strong>${data.soru}</strong> / ${maksSoru}</td>
                    <td><strong>${hesaplananYuzde}%</strong> / ${gosterilecekMaxYuzde}%</td>
                    <td style="text-align: center;">
                        <button class="delete-btn" onclick="veriSil('${data.id}')" title="Delete">🗑️</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        });
    });
}

function getTrafficColor(value, max, isBackground = false) {
    const ratio = value / max;
    if (ratio <= 1/3) return isBackground ? 'rgba(220, 53, 69, 0.15)' : 'rgba(220, 53, 69, 1)'; 
    else if (ratio <= 2/3) return isBackground ? 'rgba(255, 193, 7, 0.15)' : 'rgba(255, 193, 7, 1)';  
    else return isBackground ? 'rgba(40, 167, 69, 0.15)' : 'rgba(40, 167, 69, 1)';  
}

function updateGraph() {
    const secilenCat = graphCatSelect.value, secilenSub = graphSubSelect.value;
    let yEkseniMaksimumu = 0;
    if (secilenCat === 'TUM') { Object.values(SINAV_YAPISI).forEach(kat => Object.values(kat).forEach(val => yEkseniMaksimumu += val)); }
    else if (secilenSub === 'TUM') { Object.values(SINAV_YAPISI[secilenCat]).forEach(val => yEkseniMaksimumu += val); }
    else { yEkseniMaksimumu = SINAV_YAPISI[secilenCat][secilenSub]; }

    let filtrelenmis = tumVeriler;
    if (secilenCat !== 'TUM') {
        filtrelenmis = filtrelenmis.filter(v => v.kategori === secilenCat);
        if (secilenSub !== 'TUM') filtrelenmis = filtrelenmis.filter(v => v.bolum === secilenSub); 
    }

    const gunlukVeriler = {}, denemeTracker = {}; 
    filtrelenmis.forEach(v => {
        const tKey = v.tarih, subKey = v.kategori + "_" + v.bolum; 
        if (!denemeTracker[tKey]) denemeTracker[tKey] = {};
        if (!denemeTracker[tKey][subKey]) denemeTracker[tKey][subKey] = 0;
        denemeTracker[tKey][subKey]++; 
        const dNo = denemeTracker[tKey][subKey];
        if (!gunlukVeriler[tKey]) gunlukVeriler[tKey] = {};
        if (!gunlukVeriler[tKey][dNo]) gunlukVeriler[tKey][dNo] = 0;
        gunlukVeriler[tKey][dNo] += v.soru;
    });

    const X_Ekseni_Etiketleri = [], Y_Ekseni_Sorular = [];
    const siraliTarihler = Object.keys(gunlukVeriler).sort((a,b) => new Date(a) - new Date(b));
    siraliTarihler.forEach(tarih => {
        const denemeler = gunlukVeriler[tarih], denemeNolar = Object.keys(denemeler).map(Number).sort((a,b) => a - b);
        const isMultiple = denemeNolar.length > 1;
        denemeNolar.forEach(dNo => {
            X_Ekseni_Etiketleri.push(isMultiple ? `${formatliTarih(tarih)} (A${dNo})` : formatliTarih(tarih));
            Y_Ekseni_Sorular.push(denemeler[dNo]);
        });
    });

    let grafikBasligi = secilenCat === 'TUM' ? "All Exam Studies (Questions)" : (secilenSub !== 'TUM' ? `${secilenCat} - ${secilenSub}` : `${secilenCat} Total Questions`);
    const noktaRenkleri = Y_Ekseni_Sorular.map(soru => getTrafficColor(soru, yEkseniMaksimumu, false));

    if (myChartInstance != null) myChartInstance.destroy();
    const ctx = document.getElementById('myChart').getContext('2d');
    
    myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: X_Ekseni_Etiketleri,
            datasets: [{
                label: grafikBasligi, data: Y_Ekseni_Sorular,
                pointBackgroundColor: noktaRenkleri, pointBorderColor: noktaRenkleri,
                pointRadius: 6, pointHoverRadius: 8, borderWidth: 4, fill: true,
                segment: {
                    borderColor: ctx => {
                        if (!ctx.p0 || !ctx.p1) return;
                        const gradient = ctx.chart.ctx.createLinearGradient(ctx.p0.x, 0, ctx.p1.x, 0);
                        gradient.addColorStop(0, getTrafficColor(ctx.p0.parsed.y, yEkseniMaksimumu, false));
                        gradient.addColorStop(1, getTrafficColor(ctx.p1.parsed.y, yEkseniMaksimumu, false));
                        return gradient;
                    },
                    backgroundColor: ctx => {
                        if (!ctx.p0 || !ctx.p1) return;
                        const gradient = ctx.chart.ctx.createLinearGradient(ctx.p0.x, 0, ctx.p1.x, 0);
                        gradient.addColorStop(0, getTrafficColor(ctx.p0.parsed.y, yEkseniMaksimumu, true));
                        gradient.addColorStop(1, getTrafficColor(ctx.p1.parsed.y, yEkseniMaksimumu, true));
                        return gradient;
                    }
                }, tension: 0.2
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, max: yEkseniMaksimumu } } }
    });
}

function updatePercentGraph() {
    const secilenCat = percentCatSelect.value, secilenSub = percentSubSelect.value;
    let yEkseniMaksimumu = 0;
    if (secilenCat === 'TUM') { yEkseniMaksimumu = 100; } 
    else if (secilenSub === 'TUM') { Object.values(SINAV_YUZDELERI[secilenCat]).forEach(val => yEkseniMaksimumu += val); }
    else { yEkseniMaksimumu = SINAV_YUZDELERI[secilenCat][secilenSub]; }

    let filtrelenmis = tumVeriler;
    if (secilenCat !== 'TUM') {
        filtrelenmis = filtrelenmis.filter(v => v.kategori === secilenCat);
        if (secilenSub !== 'TUM') filtrelenmis = filtrelenmis.filter(v => v.bolum === secilenSub); 
    }

    const gunlukVeriler = {}, denemeTracker = {}; 
    filtrelenmis.forEach(v => {
        const tKey = v.tarih, subKey = v.kategori + "_" + v.bolum; 
        if (!denemeTracker[tKey]) denemeTracker[tKey] = {};
        if (!denemeTracker[tKey][subKey]) denemeTracker[tKey][subKey] = 0;
        denemeTracker[tKey][subKey]++; 
        const dNo = denemeTracker[tKey][subKey];
        if (!gunlukVeriler[tKey]) gunlukVeriler[tKey] = {};
        if (!gunlukVeriler[tKey][dNo]) gunlukVeriler[tKey][dNo] = 0;
        
        const dersMaxSoru = SINAV_YAPISI[v.kategori][v.bolum];
        const dersinSinavYuzdesi = SINAV_YUZDELERI[v.kategori][v.bolum];
        const hesaplananYuzde = (v.soru / dersMaxSoru) * dersinSinavYuzdesi;
        
        gunlukVeriler[tKey][dNo] += hesaplananYuzde;
    });

    const X_Ekseni_Etiketleri = [], Y_Ekseni_Sorular = [];
    const siraliTarihler = Object.keys(gunlukVeriler).sort((a,b) => new Date(a) - new Date(b));
    siraliTarihler.forEach(tarih => {
        const denemeler = gunlukVeriler[tarih], denemeNolar = Object.keys(denemeler).map(Number).sort((a,b) => a - b);
        const isMultiple = denemeNolar.length > 1;
        denemeNolar.forEach(dNo => {
            X_Ekseni_Etiketleri.push(isMultiple ? `${formatliTarih(tarih)} (A${dNo})` : formatliTarih(tarih));
            Y_Ekseni_Sorular.push(denemeler[dNo]);
        });
    });

    let grafikBasligi = secilenCat === 'TUM' ? "Total Exam Readiness (%)" : (secilenSub !== 'TUM' ? `${secilenCat} - ${secilenSub} (%)` : `${secilenCat} Percentage`);
    const noktaRenkleri = Y_Ekseni_Sorular.map(yuzde => getTrafficColor(yuzde, yEkseniMaksimumu, false));

    if (percentChartInstance != null) percentChartInstance.destroy();
    const ctx = document.getElementById('percentChart').getContext('2d');
    
    percentChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: X_Ekseni_Etiketleri,
            datasets: [{
                label: grafikBasligi, data: Y_Ekseni_Sorular,
                pointBackgroundColor: noktaRenkleri, pointBorderColor: noktaRenkleri,
                pointRadius: 6, pointHoverRadius: 8, borderWidth: 4, fill: true,
                segment: {
                    borderColor: ctx => {
                        if (!ctx.p0 || !ctx.p1) return;
                        const gradient = ctx.chart.ctx.createLinearGradient(ctx.p0.x, 0, ctx.p1.x, 0);
                        gradient.addColorStop(0, getTrafficColor(ctx.p0.parsed.y, yEkseniMaksimumu, false));
                        gradient.addColorStop(1, getTrafficColor(ctx.p1.parsed.y, yEkseniMaksimumu, false));
                        return gradient;
                    },
                    backgroundColor: ctx => {
                        if (!ctx.p0 || !ctx.p1) return;
                        const gradient = ctx.chart.ctx.createLinearGradient(ctx.p0.x, 0, ctx.p1.x, 0);
                        gradient.addColorStop(0, getTrafficColor(ctx.p0.parsed.y, yEkseniMaksimumu, true));
                        gradient.addColorStop(1, getTrafficColor(ctx.p1.parsed.y, yEkseniMaksimumu, true));
                        return gradient;
                    }
                }, tension: 0.2
            }]
        },
        options: { 
            responsive: true, 
            scales: { 
                y: { 
                    beginAtZero: true, 
                    max: yEkseniMaksimumu,
                    ticks: { callback: function(value) { return value.toFixed(1) + '%'; } }
                } 
            },
            plugins: {
                tooltip: { callbacks: { label: function(context) { return context.parsed.y.toFixed(2) + '%'; } } }
            }
        }
    });
}

// =======================================================================
// ==================== TEXT LIBRARY MANAGEMENT ==========================
// =======================================================================

async function fetchLibraryFromFirebase() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, "okumaMetinleri"), where("userId", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        kütüphaneMetinleri = [];
        snapshot.forEach(doc => kütüphaneMetinleri.push({ id: doc.id, ...doc.data() }));
        renderLibraryDropdowns();
    } catch(err) { console.error("Error fetching library:", err); }
}

function renderLibraryDropdowns() {
    const r1Select = document.getElementById('r1LibrarySelect');
    const r2Select = document.getElementById('r2LibrarySelect');
    
    const optionsHtml = '<option value="" disabled selected>Load from Library...</option>' + 
        kütüphaneMetinleri.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
        
    if(r1Select) r1Select.innerHTML = optionsHtml;
    if(r2Select) r2Select.innerHTML = optionsHtml;
}

async function saveTextToLibrary(titleId, textId) {
    if (!currentUser) return;
    const title = document.getElementById(titleId).value.trim();
    const text = document.getElementById(textId).value.trim();
    
    if(!title || !text) return alert("Please fill in both the title and text fields to save!");
    
    try {
        await addDoc(collection(db, "okumaMetinleri"), {
            userId: currentUser.uid,
            title: title,
            text: text,
            createdAt: new Date().getTime()
        });
        document.getElementById(titleId).value = "";
        alert("Text successfully saved to library!");
        await fetchLibraryFromFirebase();
    } catch(err) { alert("Failed to save text."); }
}

async function deleteTextFromLibrary(selectId) {
    const selectEl = document.getElementById(selectId);
    const docId = selectEl.value;
    if(!docId) return alert("Please select a text from the dropdown list to delete!");
    
    if(confirm("Are you sure you want to delete this text from your library?")) {
        try {
            await deleteDoc(doc(db, "okumaMetinleri", docId));
            alert("Text removed from library.");
            await fetchLibraryFromFirebase();
        } catch(err) { alert("Failed to delete text."); }
    }
}

function loadTextFromLibrary(selectId, textInputId) {
    const docId = document.getElementById(selectId).value;
    if(!docId) return alert("Please select a saved text first!");
    const item = kütüphaneMetinleri.find(m => m.id === docId);
    if(item) {
        document.getElementById(textInputId).value = item.text;
    }
}

// Wire up library event listeners
document.getElementById('r1SaveBtn').addEventListener('click', () => saveTextToLibrary('r1SaveTitle', 'r1TextInput'));
document.getElementById('r2SaveBtn').addEventListener('click', () => saveTextToLibrary('r2SaveTitle', 'r2TextInput'));
document.getElementById('r1LibraryLoadBtn').addEventListener('click', () => loadTextFromLibrary('r1LibrarySelect', 'r1TextInput'));
document.getElementById('r2LibraryLoadBtn').addEventListener('click', () => loadTextFromLibrary('r2LibrarySelect', 'r2TextInput'));
document.getElementById('r1LibraryDelBtn').addEventListener('click', () => deleteTextFromLibrary('r1LibrarySelect'));
document.getElementById('r2LibraryDelBtn').addEventListener('click', () => deleteTextFromLibrary('r2LibrarySelect'));


// =======================================================================
// ==================== SPEED READER CORE MOTOR ==========================
// =======================================================================

// --- READER 1: HIGHLIGHT MODE ---
let r1Words = [], r1Index = 0, r1Interval = null, r1IsPlaying = false;
const r1Display = document.getElementById('r1DisplayArea'), r1PlayBtn = document.getElementById('r1Play');

document.getElementById('r1LoadBtn').addEventListener('click', () => {
    const text = document.getElementById('r1TextInput').value.trim();
    if (!text) return alert("Please enter or load some text!");
    r1Words = text.split(/\s+/);
    r1Index = 0;
    r1Display.innerHTML = r1Words.map((w, i) => `<span id="r1w-${i}" class="word-span">${w}</span>`).join(' ');
    updateHighlight();
});

function updateHighlight() {
    if (r1Words.length === 0) return;
    document.querySelectorAll('#r1DisplayArea .word-span').forEach(el => el.classList.remove('active-word'));
    if (r1Index >= r1Words.length) r1Index = r1Words.length - 1;
    if (r1Index < 0) r1Index = 0;
    
    const targetWord = document.getElementById(`r1w-${r1Index}`);
    if (targetWord) {
        targetWord.classList.add('active-word');
        targetWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function playReader1() {
    if (r1Words.length === 0) return alert("Load some text first!");
    if (r1Index >= r1Words.length - 1) r1Index = 0;
    r1IsPlaying = true;
    r1PlayBtn.innerHTML = "⏸️ Pause";
    r1PlayBtn.classList.replace('yellow-btn', 'danger-btn');
    
    const wpm = parseInt(document.getElementById('r1Speed').value);
    const delayMs = Math.round(60000 / wpm);

    r1Interval = setInterval(() => {
        r1Index++;
        if (r1Index >= r1Words.length) { pauseReader1(); } 
        else { updateHighlight(); }
    }, delayMs);
}

function pauseReader1() {
    r1IsPlaying = false;
    clearInterval(r1Interval);
    if(r1PlayBtn) {
        r1PlayBtn.innerHTML = "▶️ Play";
        r1PlayBtn.classList.replace('danger-btn', 'yellow-btn');
    }
}

r1PlayBtn.addEventListener('click', () => r1IsPlaying ? pauseReader1() : playReader1());
document.getElementById('r1Prev').addEventListener('click', () => { r1Index -= 10; updateHighlight(); });
document.getElementById('r1Next').addEventListener('click', () => { r1Index += 10; updateHighlight(); });
document.getElementById('r1Speed').addEventListener('input', (e) => {
    document.getElementById('r1WpmValue').innerText = e.target.value;
    if (r1IsPlaying) { pauseReader1(); playReader1(); } 
});


// --- READER 2: SINGLE WORD MODE ---
let r2Words = [], r2Index = 0, r2Interval = null, r2IsPlaying = false;
const r2Display = document.getElementById('r2DisplayArea'), r2PlayBtn = document.getElementById('r2Play');

document.getElementById('r2LoadBtn').addEventListener('click', () => {
    const text = document.getElementById('r2TextInput').value.trim();
    if (!text) return alert("Please enter or load some text!");
    r2Words = text.split(/\s+/);
    r2Index = 0;
    updateSingleWord();
});

function updateSingleWord() {
    if (r2Words.length === 0) return;
    if (r2Index >= r2Words.length) r2Index = r2Words.length - 1;
    if (r2Index < 0) r2Index = 0;
    r2Display.innerText = r2Words[r2Index];
}

function playReader2() {
    if (r2Words.length === 0) return alert("Load some text first!");
    if (r2Index >= r2Words.length - 1) r2Index = 0; 
    r2IsPlaying = true;
    r2PlayBtn.innerHTML = "⏸️ Pause";
    r2PlayBtn.classList.replace('yellow-btn', 'danger-btn');
    
    const wpm = parseInt(document.getElementById('r2Speed').value);
    const delayMs = Math.round(60000 / wpm); 

    r2Interval = setInterval(() => {
        r2Index++;
        if (r2Index >= r2Words.length) { pauseReader2(); } 
        else { updateSingleWord(); }
    }, delayMs);
}

function pauseReader2() {
    r2IsPlaying = false;
    clearInterval(r2Interval);
    if(r2PlayBtn) {
        r2PlayBtn.innerHTML = "▶️ Play";
        r2PlayBtn.classList.replace('danger-btn', 'yellow-btn');
    }
}

r2PlayBtn.addEventListener('click', () => r2IsPlaying ? pauseReader2() : playReader2());
document.getElementById('r2Prev').addEventListener('click', () => { r2Index -= 10; updateSingleWord(); });
document.getElementById('r2Next').addEventListener('click', () => { r2Index += 10; updateSingleWord(); });
document.getElementById('r2Speed').addEventListener('input', (e) => {
    document.getElementById('r2WpmValue').innerText = e.target.value;
    if (r2IsPlaying) { pauseReader2(); playReader2(); } 
});

// =======================================================================
// ==================== 6. MENÜ: TEST MERKEZİ (GENETICS) =================
// =======================================================================

// DOM Elementleri
const testView = document.getElementById('testView');
document.getElementById('navToTestBtn').addEventListener('click', () => showView('test')); // showView fonksiyonuna 'test' kuralını eklemeyi unutma!

const testSetupArea = document.getElementById('testSetupArea');
const testActiveArea = document.getElementById('testActiveArea');
const questionTitle = document.getElementById('questionTitle');
const optionsContainer = document.getElementById('optionsContainer');
const feedbackBox = document.getElementById('feedbackBox');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const correctScoreEl = document.getElementById('correctScore');
const wrongScoreEl = document.getElementById('wrongScore');
const questionCounterText = document.getElementById('questionCounterText');

// Soru Veritabanı (İlk 5 Soru Örnek Olarak Eklendi)
const geneticsQuestions = [
    {
        q: "1.) Children of older fathers inherit more point mutations than children of younger fathers because:",
        options: [
            "a) The sperm originates from spermatogonia that have already undergone many replication cycles",
            "b) In older men the cohesin is weakened",
            "c) Because over time the meiotic spindle apparatus becomes more prone to error"
        ],
        correct: [0], // 0 = a şıkkı doğru
        explanation: "Сперматозоїди утворюються зі сперматогоніїв, які протягом життя чоловіка проходять багато циклів реплікації ДНК. З кожним циклом зростає ймовірність виникнення помилок (точкових мутацій)."
    },
    {
        q: "2.) Huntington's disease does not develop until advanced age because:",
        options: [
            "a) mutant Huntington's accumulates over time and damages neurons",
            "b) the number of CAG trinucleotide repeats increases over time",
            "c) in old age the immune defense is weakened"
        ],
        correct: [0],
        explanation: "Хвороба Гантінгтона викликана мутантним білком, який з часом накопичується в нейронах і зрештою призводить до їхньої загибелі. Для досягнення токсичного рівня потрібен час."
    },
    {
        q: "3.) ... is a trigger for Huntington's disease:",
        options: [
            "a) Base substitution",
            "b) A Nonsense Mutation",
            "c) One deletion",
            "d) Trinucleotide expansion"
        ],
        correct: [3], // 3 = d şıkkı
        explanation: "Хвороба Гантінгтона спричинена експансією (патологічним збільшенням кількості) тринуклеотидних повторів CAG у гені HTT."
    },
    {
        q: "4.) What is the main risk factor for the occurrence of a recessive hereditary disease:",
        options: [
            "a) Higher age of the mother",
            "b) Marriage among relatives",
            "c) Higher age of the father",
            "d) Somatic mutations"
        ],
        correct: [1],
        explanation: "Шлюб між близькими родичами (інбридинг) значно підвищує ризик того, що обидва батьки передадуть дитині однаковий рецесивний алель, успадкований від спільного предка."
    },
    {
        q: "5.) In Prader-Willi syndrome:",
        options: [
            "a) If the allele inherited from the father is active",
            "b) Do sick fathers always have healthy sons",
            "c) Can mothers with a defective allele have sick children",
            "d) Do sick people have healthy mothers"
        ],
        correct: [3],
        explanation: "Синдром Прадера-Віллі виникає через втрату функції батьківської копії генів на хромосомі 15. Мати зазвичай здорова, оскільки її копія генів у цьому регіоні в нормі інактивована (через геномний імпринтинг)."
    },
    {
        q: "6.) Which genetic defect is present in achondroplasia:",
        options: [
            "a) Autosomal dominant inheritance",
            "b) There are no healthy carriers",
            "c) Mutation in the fibroblast growth factor receptor gene FGR3",
            "d) Accumulation due to new mutation"
        ],
        correct: [0, 2],
        explanation: "Ахондроплазія успадковується за аутосомно-домінантним типом і найчастіше спричинена мутацією в гені FGFR3 (рецептор фактора росту фібробластів 3). Здорові носії відсутні, оскільки наявність хоча б одного мутантного алеля викликає хворобу."
    },
    {
        q: "7.) In hypophosphatemia (x chromosomal dominant):",
        options: [
            "a) All daughters of a sick woman are sick",
            "b) All sons of a sick woman are sick",
            "c) All daughters of a sick man are sick",
            "d) Half of the daughters of a sick man are sick"
        ],
        correct: [2],
        explanation: "Оскільки захворювання є Х-зчепленим домінантним, хворий батько (який має мутантну Х-хромосому) обов'язково передасть цю хромосому всім своїм донькам, тому всі вони будуть хворими. Синам він передає Y-хромосому, тому вони будуть здоровими."
    },
    {
        q: "8.) Tick correct statements:",
        options: [
            "a) XX maleness denotes individuals with female sex chromosomes but sterile male phenotype",
            "b) Hypertrichosis (heavy hair growth) on the ears is caused by one of the few Y-chromosomal genes",
            "c) Females with three X chromosomes have two Barr bodies in their nuclei"
        ],
        correct: [0, 1, 2],
        explanation: "Синдром де ля Шапеля (ХХ-чоловіки) характеризується чоловічим фенотипом при жіночому каріотипі. Гіпертрихоз вушних раковин традиційно вважається Y-зчепленою ознакою. Жінки з каріотипом ХХХ (синдром трипло-Х) мають два тільця Барра, оскільки інактивуються всі Х-хромосоми, крім однієї."
    },
    {
        q: "9.) A human individual genome:",
        options: [
            "a) Differs from the pangenome by approx. 4-5 million nucleotide polymorphisms",
            "b) Is a mosaic of sequences from 13 anonymous subjects",
            "c) Does not contain recessive lethal alleles",
            "d) Differs from the reference genome at >4 million sites"
        ],
        correct: [0, 3],
        explanation: "Індивідуальний геном людини зазвичай відрізняється від еталонного (референсного) геному приблизно на 4-5 мільйонів однонуклеотидних поліморфізмів (SNP). У кожної людини також є кілька прихованих рецесивних летальних алелів."
    },
    {
        q: "10.) Gene mutations can be triggered by:",
        options: [
            "a) Spontaneous tautomerization of bases",
            "b) The deletion of chromosoneme pieces",
            "c) Reactive oxygen compounds",
            "d) Errors in the replication (slippage) of nucleotide repeats"
        ],
        correct: [0, 2, 3],
        explanation: "Генні мутації можуть бути викликані спонтанною таутомеризацією азотистих основ, впливом активних форм кисню (АФК) та помилками під час реплікації ДНК (наприклад, прослизанням полімерази). Втрата ділянок хромосом (делеція) відноситься до хромосомних мутацій, а не генних."
    },
    {
        q: "11.) Point mutations result from:",
        options: [
            "a) Point mutations arise from mutagenic agents and replication errors",
            "b) Somatic mutations are hereditary",
            "c) Base substitutions lead to microscopically visible changes in chromosome structure",
            "d) A mutation need not result in a visible change in phenotype"
        ],
        correct: [0, 3],
        explanation: "Точкові мутації виникають через помилки реплікації або під дією мутагенів. Багато мутацій є мовчазними і не змінюють фенотип. Соматичні мутації не передаються нащадкам, а точкові заміни баз неможливо побачити в мікроскоп."
    },
    {
        q: "12.) Tick the correct statements about frameshift mutations:",
        options: [
            "a) The loss of 3 bases restores the original reading frame",
            "b) The gain of one base leads to a frameshift mutation",
            "c) The gain of 3 bases leads to a frameshift mutation"
        ],
        correct: [0, 1],
        explanation: "Втрата або додавання кількості баз, не кратної 3 (наприклад, 1 або 2 бази), зсуває рамку зчитування, що повністю змінює білок. Втрата або додавання рівно 3 баз зберігає загальну рамку зчитування, лише видаляючи або додаючи одну амінокислоту."
    },
    {
        q: "13.) Conditional mutations:",
        options: [
            "a) Show a phenotype only under certain conditions",
            "b) Are mutations that improve adaptation",
            "c) Are mutations in essential genes",
            "d) Occur only under certain conditions"
        ],
        correct: [0],
        explanation: "Умовні мутації (conditional mutations) — це мутації, які проявляються у вигляді зміненого фенотипу лише за певних умов середовища (наприклад, при підвищенні температури), тоді як за нормальних умов організм виглядає здоровим."
    },
    {
        q: "14.) Tick the correct statements for telomerase:",
        options: [
            "a) 10-15% of tumors use ALT to evade immune defense by T cells",
            "b) Metastasis triggers the expression of oncogenes",
            "c) Apoptosis stimulates DNA repair in tumors",
            "d) Telomerase is active in most tumors"
        ],
        correct: [3],
        explanation: "Теломераза активна у більшості (близько 85-90%) злоякісних пухлин. Це дозволяє раковим клітинам нескінченно ділитися, постійно відновлюючи кінці хромосом (теломери) і уникаючи клітинного старіння."
    },
    {
        q: "15.) Tick the correct statements (selection, founder effect):",
        options: [
            "a) Selection improves the adaptation of a population",
            "b) Mutations improve the adaptation of a population",
            "c) Microevolution through gene flow easily results in the accidental loss of rare alleles",
            "d) Rare alleles can be enriched by the founder effect"
        ],
        correct: [0, 3],
        explanation: "Природний добір покращує адаптацію популяції до середовища. Ефект засновника (founder effect) виникає, коли невелика група відокремлюється від основної популяції, що може випадково різко збільшити частоту певних рідкісних алелів."
    },
    {
        q: "16.) New genes are created by:",
        options: [
            "a) When two genes are independently segregated, the frequency of parental and recombinant phenotypes is the same",
            "b) The degree of hybridization on a gene array is a measure of the similarity of DNA sequences",
            "c) New genes arise from the duplications and diversification of existing genes",
            "d) New genes arise from pseudogenes"
        ],
        correct: [2],
        explanation: "В процесі еволюції нові гени найчастіше виникають шляхом дуплікації (подвоєння) існуючих генів з їхньою подальшою дивергенцією — накопиченням мутацій, що дозволяє одному з генів набути нової функції."
    },
    {
        q: "17.) Tick correct statements (degree of hybridization, new genes emerge):",
        options: [
            "a) The degree of hybridization on a gene array is a measure of the similarity of DNA",
            "b) There is low genetic diversity between persons of African origin",
            "c) New genes arise from the duplications and diversification of existing genes",
            "d) Polypeptide sequences are used to predict gene sequences",
            "e) New genes arise from pseudogenes"
        ],
        correct: [0, 2],
        explanation: "Ступінь гібридизації ДНК прямо відображає схожість послідовностей (чим більше збігів, тим сильніший зв'язок). Нові гени виникають шляхом дуплікації та дивергенції. Твердження про низьку різноманітність в Африці невірне — африканські популяції мають найвищу генетичну різноманітність."
    },
    {
        q: "18.) A DNA sequence ATGCTT becomes by the transient tautomerization of keto- to enolguanine after two replication steps to:",
        options: [
            "a) ATACTT",
            "b) ATCGTT",
            "c) TACGAA",
            "d) ATCCTT"
        ],
        correct: [0],
        explanation: "Таутомерна (енольна) форма гуаніну утворює помилкові водневі зв'язки з тиміном (замість цитозину). Після двох циклів реплікації ця помилка закріплюється, і пара G-C замінюється на пару A-T. Отже, ATGCTT перетворюється на ATACTT."
    },
    {
        q: "19.) A complementation test shows:",
        options: [
            "a) Whether a material is inherited extrachromosomally",
            "b) Whether two mutations with the same phenotype affect the same gene",
            "c) Whether two alleles are incompletely dominant or codominant",
            "d) Whether horizontal gene transfer is present"
        ],
        correct: [1],
        explanation: "Тест на комплементацію використовується в генетиці для того, щоб визначити, чи знаходяться дві рецесивні мутації, які викликають однаковий фенотип (наприклад, однакову хворобу), в одному й тому ж гені (алелі) чи в різних генах."
    },
    {
        q: "20.) Through chromosome fusions:",
        options: [
            "a) If meiotic recombination is reduced",
            "b) If meiotic recombination is increased",
            "c) Become hybrids fertile",
            "d) If the chromosome number is reduced"
        ],
        correct: [3],
        explanation: "Злиття хромосом (наприклад, робертсонівські транслокації, коли дві акроцентричні хромосоми зливаються в одну) призводить до зменшення загальної кількості хромосом у каріотипі індивіда."
    },
    {
        q: "21.) What is true of Spo 11:",
        options: [
            "a) Spo 11 induces DNA double-strand breaks in meiosis."
        ],
        correct: [0],
        explanation: "Білок Spo11 відповідає за ініціацію мейотичної рекомбінації, створюючи запрограмовані дволанцюгові розриви ДНК під час профази I мейозу."
    },
    {
        q: "22.) What are the sub-disciplines of genetics?",
        options: [
            "a) Classical genetics",
            "b) Molecular genetics",
            "c) Population Genetics",
            "d) Quantitative genetics",
            "e) Developmental Genetics"
        ],
        correct: [0, 1, 2, 3, 4],
        explanation: "Генетика є широкою наукою, яка охоплює всі ці субдисципліни: класичну (менделівську), молекулярну, популяційну, кількісну та генетику розвитку."
    },
    {
        q: "23.) What does classical genetics cover?",
        options: [
            "a) How traits are inherited",
            "b) What genes are made of",
            "c) What influences their penetrance",
            "d) How genes influence each other",
            "e) Mendelian Inheritance Theory"
        ],
        correct: [0, 4],
        explanation: "Класична генетика насамперед вивчає закономірності успадкування ознак на рівні всього організму (теорія Менделя). Вивчення того, з чого складаються гени, відноситься до молекулярної генетики."
    },
    {
        q: "24.) What does molecular genetics cover?",
        options: [
            "a) What influences the expression of genes",
            "b) Investigates the molecular basis of heredity"
        ],
        correct: [0, 1],
        explanation: "Молекулярна генетика досліджує фізичну та хімічну структуру ДНК/РНК, а також механізми експресії генів на молекулярному рівні."
    },
    {
        q: "25.) What does population genetics cover?",
        options: [
            "a) Distribution of genes and their variations in a population",
            "b) Advantages and disadvantages of genes and variants on populations and ecosystems"
        ],
        correct: [0, 1],
        explanation: "Популяційна генетика вивчає розподіл частот алелів та їхню зміну в популяціях під впливом еволюційних факторів (добору, дрейфу, мутацій)."
    },
    {
        q: "26.) What does quantitative genetics cover?",
        options: [
            "a) Which genes are clustered in which combinations and populations",
            "b) Which selection advantages result from this",
            "c) How genes influence each other"
        ],
        correct: [0, 1, 2],
        explanation: "Кількісна генетика зазвичай вивчає безперервні (кількісні) ознаки, які визначаються багатьма генами, їхню взаємодію між собою та реакцію популяції на відбір."
    },
    {
        q: "27.) What does developmental genetics cover?",
        options: [
            "a) How genes control the development of an organism"
        ],
        correct: [0],
        explanation: "Генетика розвитку вивчає, як саме гени керують ростом, розвитком та диференціацією клітин організму від однієї зиготи до дорослої особини."
    },
    {
        q: "28.) What are the requirements for model organisms? Examples of model organisms?",
        options: [
            "a) easy breeding in the laboratory",
            "b) Great progeny",
            "c) Good distinguishability of phoenotypes",
            "d) Small genome",
            "e) Mutability",
            "f) Relevance to human needs"
        ],
        correct: [0, 1, 2, 3, 4],
        explanation: "Ідеальні модельні організми (наприклад, дрозофіла, миша, дріжджі) швидко розмножуються, дають багато нащадків, легко утримуються в лабораторії, мають добре помітні фенотипи та відносно невеликий геном."
    },
    {
        q: "29.) In experiments by Frederik Griffith (1928) with Streptococcus infection of mice, have:",
        options: [
            "a) Mice did not survive infection with a DNA free cell extract",
            "b) Mice survived the double infection with the non-pathogenic strain and heat killed virulent strain",
            "c) Mice survived infection with a heat-killed virulent strain",
            "d) Mice survived infection with the non-virulent strain"
        ],
        correct: [2, 3],
        explanation: "В експерименті Гріффіта миші виживали, якщо їм вводили або живий невірулентний штам, або вбитий нагріванням вірулентний штам. Однак суміш живого невірулентного і вбитого вірулентного штаму вбивала мишей через трансформацію."
    },
    {
        q: "30.) Mass spectrometry:",
        options: [
            "a) can detect known proteins in a sample",
            "b) is a method for the unwinding of proteins",
            "c) can detect unknown proteins in a sample"
        ],
        correct: [0, 2],
        explanation: "Мас-спектрометрія — це потужний аналітичний метод, який використовується для ідентифікації та кількісного визначення як відомих, так і невідомих білків (за їхньою масою та зарядом) у складних біологічних зразках."
    },
    {
        q: "31.) What was shown in the Ames test:",
        options: [
            "a) This tests chemical components for mutagenic effects using bacterial Strains"
        ],
        correct: [0],
        explanation: "Тест Еймса використовує спеціальні бактеріальні штами (найчастіше Salmonella typhimurium) для перевірки здатності різних хімічних речовин викликати мутації."
    },
    {
        q: "32.) The Barr Body is that:",
        options: [
            "a) condensed active X chromosome of the female in the interphase nucleus",
            "b) inactivated X chromosome of the female in the interphase nucleus",
            "c) X Chromosome in the interphase cell nucleus of the male",
            "d) condensed heterochromatin of the Y chromosome in the interphase nucleus"
        ],
        correct: [1],
        explanation: "Тільце Барра — це щільно конденсована, неактивна Х-хромосома, яка присутня в інтерфазних ядрах соматичних клітин у самок ссавців для забезпечення компенсації дози генів."
    },
    {
        q: "33.) Tick correct statements:",
        options: [
            "a) There are diploid and haploid zygotes",
            "b) Plant gametophyte gives rise to haploid gametes by mitosis",
            "c) The plant sporophyte is haploid",
            "d) In the animal life cycle, the diploid nuclear phase predominates"
        ],
        correct: [1, 3],
        explanation: "Зиготи завжди диплоїдні (бо це результат злиття двох гамет). У рослин гаметофіт вже є гаплоїдним, тому він утворює гамети шляхом мітозу, а спорофіт — диплоїдний. У тваринному циклі дійсно переважає диплоїдна фаза."
    },
    {
        q: "34.) Sister chromatids separate:",
        options: [
            "a) when tension acts on kinetochore",
            "b) as long as Seperase is bound to Securin",
            "c) when cohesin rings open",
            "d) when cohesin binds to the chromatids"
        ],
        correct: [2],
        explanation: "Сестринські хроматиди розходяться в анафазі, коли фермент сепараза розрізає когезинові кільця, що утримували їх разом. (Сепараза починає діяти тільки після того, як від неї від'єднується секурин)."
    },
    {
        q: "35.) Eugenics:",
        options: [
            "a) is the study of quantitative characteristics",
            "b) was the effort to control the human evolution",
            "c) is a process for the production of purebred plant lines",
            "d) is the reduction of the gene pool of a population due to a genetic bottleneck effect."
        ],
        correct: [1],
        explanation: "Євгеніка — це антинаукова соціально-філософська концепція, яка в минулому ставила за мету «покращення» генетичного фонду та контроль еволюції людини шляхом селективного розмноження."
    },
    {
        q: "36.) Plasmids as cloning vectors usually have:",
        options: [
            "a) an insertion marker",
            "b) A replication origin",
            "c) a multiple cloning site",
            "d) a resistance gene",
            "e) a cis methylating nucleotide reagent"
        ],
        correct: [0, 1, 2, 3],
        explanation: "Стандартні плазміди, що використовуються як вектори для клонування, повинні мати: точку початку реплікації (ori), сайт множинного клонування (MCS) для вставки чужорідної ДНК, а також гени резистентності (наприклад, до антибіотиків) та маркерні гени для відбору трансформованих бактерій."
    },
    {
        q: "37.) The karyotype:",
        options: [
            "a) is changed by base substitution",
            "b) is the description of the properties of a set of chromosomes",
            "c) is changed by chromosome polymorphisms",
            "d) is changed by genome mutations"
        ],
        correct: [1, 3],
        explanation: "Каріотип — це сукупність ознак повного набору хромосом клітини. Він змінюється під час геномних мутацій (зміна кількості хромосом) та великих хромосомних мутацій, але не змінюється від точкових мутацій (заміни баз)."
    },
    {
        q: "38.) Through chromosome fusions:",
        options: [
            "a) meiotic recombination is reduced",
            "b) meiotic recombination is increased",
            "c) hybrids become fertile",
            "d) the number of chromosomes is reduced"
        ],
        correct: [3],
        explanation: "Злиття хромосом (наприклад, робертсонівська транслокація, коли зливаються дві хромосоми) фізично зменшує загальну кількість хромосом у каріотипі, хоча кількість генетичного матеріалу може залишатися майже незмінною."
    },
    {
        q: "39.) Base Excision repair needed:",
        options: [
            "a) DNA glycosylase",
            "b) Endonuclease",
            "c) Ligase",
            "d) Exonuclease"
        ],
        correct: [0, 1, 2],
        explanation: "Ексцизійна репарація основ (BER) потребує ДНК-глікозилази (для видалення пошкодженої основи), АП-ендонуклеази (для розрізання ланцюга), ДНК-полімерази (для заповнення прогалини) та лігази (для зшивання ланцюга)."
    },
    {
        q: "40.) Tick correct statements:",
        options: [
            "a) cell nuclei become haploid by mitotic division",
            "b) mitosis gives rise to sister cells with the same number of chromosomes",
            "c) in mitotic division, the DNA content of the cell is halved",
            "d) mitosis results in cells with the same number of chromosomes as the parent cell"
        ],
        correct: [1, 2, 3],
        explanation: "Під час мітозу материнська клітина ділиться, утворюючи дочірні клітини з такою ж кількістю хромосом (від 2n до 2n). Однак вміст ДНК дійсно зменшується вдвічі порівняно з фазою G2 (де він був 4n після реплікації, і стає 2n у дочірніх)."
    },
    {
        q: "41.) Mendel rule F2 generation:",
        options: [
            "a) Cleavage rule-crossing of uniform F1 leads to splitting into different phenotypes in F2 in certain frequencies 9:3:3:1."
        ],
        correct: [0],
        explanation: "Третій закон Менделя (закон незалежного успадкування). При схрещуванні дигетерозигот (F1) у другому поколінні (F2) спостерігається розщеплення за фенотипом у співвідношенні 9:3:3:1."
    },
    {
        q: "42.) Genome Editing. Tick the correct statements:",
        options: [
            "a) Cas9 can only cut near the PAM sequence",
            "b) Cas9 is smaller than Fok1",
            "c) Cas9 generates DNA double-strand breaks",
            "d) dead Cas9 can not cut DNA"
        ],
        correct: [0, 2, 3],
        explanation: "Фермент Cas9 працює лише за наявності мотиву PAM поруч із цільовою послідовністю. Він створює дволанцюгові розриви. \"Мертвий\" Cas9 (dCas9) мутований так, що він зв'язується з ДНК, але не здатний її розрізати."
    },
    {
        q: "43.) Gregor Mendel has:",
        options: [
            "a) demonstrated that hereditary characteristics do not occur in arbitrary ratios in the offspring",
            "b) Crossing experiments carried out on pea plants",
            "c) interpreted the change of living beings as an adaptation to the environment",
            "d) Recognized that living cells only arise from living cells"
        ],
        correct: [0, 1],
        explanation: "Грегор Мендель проводив експерименти зі схрещування гороху і довів, що ознаки успадковуються не випадково, а за суворими математичними законами. Адаптація — це Дарвін, а клітинна теорія («клітина від клітини») — Вірхов."
    },
    {
        q: "44.) Examples of DNA repair by homologous recombination are:",
        options: [
            "a) Single strand annealing",
            "b) Break-Induced Replication",
            "c) Synthesis-dependent Strand Annealing",
            "d) SOS Answer"
        ],
        correct: [0, 1, 2],
        explanation: "Відпал одиночних ланцюгів (SSA), реплікація, індукована розривом (BIR), та відпал ланцюгів, залежний від синтезу (SDSA) — це механізми репарації за допомогою гомологічної рекомбінації. SOS-відповідь — це бактеріальна екстрена, схильна до помилок система."
    },
    {
        q: "45.) In electrophoresis:",
        options: [
            "a) large DNA molecules sink rapidly to the bottom",
            "b) DNA molecules migrate to the anode",
            "c) AT-rich and GC-rich DNA molecules are separated from each other.",
            "d) DNA molecules migrate through a cesium chloride gradient"
        ],
        correct: [1],
        explanation: "Оскільки молекули ДНК мають негативний заряд (через фосфатні групи), під час електрофорезу в гелі вони рухаються до позитивно зарядженого електрода — анода."
    },
    {
        q: "46.) Tick correct statements:",
        options: [
            "a) Ligases synthesize RNA primers during replication",
            "b) Telomerases remove the RNA primers at the ends of replicating DNA molecules",
            "c) Helicases unwind the DNA double helix",
            "d) Topoisomerases can dissolve DNA hemicatemers"
        ],
        correct: [2, 3],
        explanation: "Хелікази розкручують подвійну спіраль ДНК. Топоізомерази знімають напругу та розплутують молекули (катенани). РНК-праймери синтезує праймаза, а не лігаза."
    },
    {
        q: "47.) Gene Disruption in the Mouse. Tick the correct statements:",
        options: [
            "a) after homologous integration of a disrupted gene, the recipient cell becomes resistant to neomycin and ganciclovir",
            "b) for gene disruption, a resistance marten gene is inserted into the ori sequence of the vector",
            "c) normally, in embryonic stem cells, the disruption of the two copies of the target gene occurs simultaneously",
            "d) the TK gene makes a cell sensitive to ganciclovir"
        ],
        correct: [0, 3],
        explanation: "У технології нокауту генів ген резистентності до неоміцину (Neo) забезпечує виживання клітин з вбудованим вектором, а ген тимідинкінази (TK) робить клітини чутливими до ганцикловіру (загибель при випадковій не цільовій вставці). Правильна гомологічна рекомбінація дає стійкість до обох препаратів."
    },
    {
        q: "48.) The Philadelphia chromosome:",
        options: [
            "a) arises from chromothripsis",
            "b) encodes the chimeric BCR ABL protein",
            "c) results from a translocation of chromosomes 9 and 22",
            "d) shows increased sister chromatid exchange"
        ],
        correct: [1, 2],
        explanation: "Філадельфійська хромосома — це аномальна хромосома 22, що виникає внаслідок реципрокної транслокації між хромосомами 9 і 22. Вона містить злитий (химерний) онкоген BCR-ABL, який викликає хронічний мієлоїдний лейкоз."
    },
    {
        q: "49.) Tick correct statements:",
        options: [
            "a) In interphase, the DNA forms 300 nm long DNA loops on a histone scaffold",
            "b) Cohesins hold sister chromatids together",
            "c) Gene-rich chromosomes are located inside the cell nucleus",
            "d) In the interphase nucleus, chromosomes occupy clearly delineated domains"
        ],
        correct: [1, 2, 3],
        explanation: "Когезини дійсно скріплюють сестринські хроматиди. Хромосоми, багаті на гени, зазвичай знаходяться ближче до центру ядра, а в інтерфазному ядрі кожна хромосома займає свою окрему чітку територію (домен)."
    },
    {
        q: "50.) These defects are repaired by the following DNA repair systems:",
        options: [
            "a) DNA single-strand breaks by mismatch repair",
            "b) Replication errors due to non-homolohous end joining",
            "c) Pyrimidine dimers by photoactivation",
            "d) Structurally modified DNA by nucleotide excision repair"
        ],
        correct: [2, 3],
        explanation: "Піримідинові димери (спричинені УФ-випромінюванням) можуть репаруватися фотоактивацією (у деяких організмів). Об'ємні структурні пошкодження ДНК виправляються системою ексцизійної репарації нуклеотидів (NER)."
    },
    {
        q: "51.) Nucleosomes:",
        options: [
            "a) are the highest packaging unit of DNA in the metaphase chromosome",
            "b) contain approx. 150 bp of DNA",
            "c) consist of histones, non-histone proteins attached to DNA",
            "d) consist of a core of 12 histones"
        ],
        correct: [1],
        explanation: "Нуклеосома — це базова (найнижча, а не найвища) одиниця пакування хроматину. Вона складається з октамеру (8, а не 12) гістонових білків, навколо якого обмотано приблизно 146-147 пар основ (близько 150 bp) ДНК."
    },
    {
        q: "52.) Check Mitotic Checkpoints:",
        options: [
            "a) Whether the chromosomes are completely condensed when they enter a division",
            "b) Whether DNA synthesis is complete prior to a division",
            "c) Whether the DNA is intact before entering a division",
            "d) Whether the anaphase is completely finished",
            "e) Whether sufficient nutrients are available for further divisions"
        ],
        correct: [1, 2, 4],
        explanation: "Контрольні точки клітинного циклу перевіряють: чи вистачає поживних речовин (G1), чи непошкоджена ДНК і чи повністю завершена її реплікація (G2/M). Вони не перевіряють завершення анафази (контролюється початок анафази)."
    },
    {
        q: "53.) Conditional mutations:",
        options: [
            "a) show a phenotype only under certain conditions",
            "b) are mutations that improve adaptation",
            "c) are mutations in essential genes",
            "d) only occur under certain conditions"
        ],
        correct: [0],
        explanation: "Умовні мутації (conditional mutations) — це такі мутації, фенотипічний прояв яких залежить від умов навколишнього середовища (наприклад, температури). В одних умовах фенотип нормальний, в інших — мутантний."
    },
    {
        q: "54.) Histones can be used to regulate chromatin condensation:",
        options: [
            "a) be esterified",
            "b) Be alkylated",
            "c) be methylated",
            "d) be acetylated"
        ],
        correct: [2, 3],
        explanation: "Хроматин регулюється епігенетичними модифікаціями гістонів. Найпоширенішими механізмами є метилювання (може як активувати, так і пригнічувати гени) та ацетилювання (зазвичай розпушує хроматин і активує транскрипцію)."
    },
    {
        q: "55.) Mechanisms of gene transfer in bacteria are:",
        options: [
            "a) Transcription",
            "b) Conjugation",
            "c) Transformation",
            "d) Translocation"
        ],
        correct: [1, 2],
        explanation: "Горизонтальне перенесення генів у бактерій відбувається за допомогою кон'югації (через пілі), трансформації (поглинання вільної ДНК) та трансдукції (за допомогою бактеріофагів). Транскрипція — це синтез РНК."
    },
    {
        q: "56.) Tick correct statements:",
        options: [
            "a) The human genome codes for more than 250,000 proteins",
            "b) The human genome comprises about 20,000 genes",
            "c) The human genome codes for more than 20,000 proteins",
            "d) The human genome comprises approximately 250,000 genes"
        ],
        correct: [0, 1, 2],
        explanation: "Геном людини містить лише близько 20 000 генів, що кодують білки. Однак завдяки альтернативному сплайсингу та посттрансляційним модифікаціям, ці гени можуть виробляти понад 250 000 різних білків (протеом)."
    },
    {
        q: "57.) When two alleles with frequencies 80% allele A and 20% allele a are present in a population:",
        options: [
            "a) the frequency of homozygous individuals is aa: 4%.",
            "b) the frequency of homozygous individuals is AA: 80%.",
            "c) is the frequency of heterozygous individuals Aa: 50%.",
            "d) all individuals are heterozygous"
        ],
        correct: [0],
        explanation: "За законом Гарді-Вайнберга: p=0.8 (A), q=0.2 (a). Частота гомозигот aa (q²) = 0.2 * 0.2 = 0.04 (4%). Частота AA (p²) = 0.8 * 0.8 = 0.64 (64%). Частота гетерозигот Aa (2pq) = 2 * 0.8 * 0.2 = 0.32 (32%). Тому правильний лише перший варіант."
    },
    {
        q: "58.) Tick correct statements:",
        options: [
            "a) With independent segregation of two genes, the frequency of parental and recombinant phenotypes is the same",
            "b) The degree of hybridization on a gene array is a measure of the similarity of DNA sequences",
            "c) New genes arise from the duplications and diversification of existing genes",
            "d) New genes arise from pseudogenes"
        ],
        correct: [0, 1, 2],
        explanation: "При незалежному розщепленні (гени на різних хромосомах) частота рекомбінантів становить 50%, що дорівнює частоті батьківських фенотипів. Гібридизація базується на комплементарності (схожості) ДНК. Нові гени зазвичай виникають через дуплікацію."
    },
    {
        q: "59.) Huntington's disease does not develop until advanced age because:",
        options: [
            "a) mutant Huntington's accumulates over time and damages neurons",
            "b) the number of CAG trinucleotide repeats increases over time",
            "c) in old age the immune defense is weakened"
        ],
        correct: [0],
        explanation: "Як і в питанні №2: мутантний білок гантінгтін накопичується поступово, формуючи агрегати в нейронах. Нейротоксичність досягає критичного рівня, що викликає симптоми, лише у дорослому або похилому віці."
    },
    {
        q: "60.) Which bases are purines:",
        options: [
            "a) Adenine",
            "b) Guanine",
            "c) Uracil",
            "d) Thymine"
        ],
        correct: [0, 1],
        explanation: "Аденін (A) та гуанін (G) є пуриновими основами (мають подвійне кільце). Цитозин (C), тимін (T) та урацил (U) є піримідинами (мають одне кільце)."
    },
    {
        q: "61.) Suppressor Screen:",
        options: [
            "a) searches for genes that make cells more resistant to mutations",
            "b) can help in the elucidation of biochemical pathways",
            "c) searches for mutations that cancel the defect caused by another mutation",
            "d) searches for transcription suppressors that stop cell proliferation"
        ],
        correct: [1, 2],
        explanation: "Супресорний скринінг — це генетичний метод пошуку вторинних мутацій, які скасовують (супресують) фенотип первинної мутації. Це допомагає знайти гени, які взаємодіють між собою в одному біохімічному шляху."
    },
    {
        q: "62.) The SRY gene sits:",
        options: [
            "a) on the short arm of the Y chromosome",
            "b) on the long arm of the Y chromosome",
            "c) on the Xchromosome",
            "d) in the pseudoautosomal region of the Y chromosome"
        ],
        correct: [0],
        explanation: "Ген SRY (Sex-determining Region Y), який запускає розвиток чоловічої статі, розташований на короткому плечі Y-хромосоми, безпосередньо поруч із псевдоаутосомним регіоном (але не всередині нього)."
    },
    {
        q: "63.) Tick correct statements:",
        options: [
            "a) a benign tumor displaces surrounding tissue through its growth",
            "b) Passenger mutations in tumors promote their poliferation",
            "c) a single critical mutation can cause cancer",
            "d) Neoplasia is the spread of a tumor to other tissues"
        ],
        correct: [0],
        explanation: "Доброякісна пухлина росте, розсуваючи (витісняючи) навколишні тканини, але не проростаючи в них. Пасажирські мутації НЕ сприяють проліферації (це роблять драйверні). Рак зазвичай потребує накопичення кількох мутацій. Поширення пухлини — це метастазування."
    },
    {
        q: "64.) Tick correct statements:",
        options: [
            "a) Helicase B inhibits divisions depending on cell density",
            "b) Bcl2 (B cell lymphoma 2) is a porto-oncogene",
            "c) the tumor suppressor APC promotes angiogenesis",
            "d) pRB (retinoblastoma protein) is a tumor suppressor"
        ],
        correct: [1, 3],
        explanation: "Bcl2 — це класичний протоонкоген (запобігає апоптозу, дозволяючи клітинам виживати). Білок pRb (ретинобластома) є одним із найважливіших пухлинних супресорів, який блокує клітинний цикл."
    },
    {
        q: "65.) Gene regulation:",
        options: [
            "a) when lactose is present, the lac repression protein binds to the operator",
            "b) if lactose is not present, no transcription occurs from the lac operon",
            "c) when lactose and glucose are present, the catabolite activating protein does not bind efficiently",
            "d) CAMP promotes the binding of the catabolite activating protein"
        ],
        correct: [1, 2, 3],
        explanation: "Без лактози репресор блокує оперон. Коли є глюкоза, рівень цАМФ (cAMP) падає, тому CAP (катаболіт-активуючий білок) не зв'язується. цАМФ необхідний для прикріплення CAP до ДНК. (Варіант А невірний, бо лактоза навпаки ЗНІМАЄ репресор)."
    },
    {
        q: "66.) A DNA sequence ATGCTT becomes by the transient tautomerization of keto- to enolguanine after two replication steps to:",
        options: [
            "a) ATACTT",
            "b) ATCGTT",
            "c) TACGAA",
            "d) ATCCTT"
        ],
        correct: [0],
        explanation: "Як і в питанні №18, таутомерія гуаніну (перехід у енольну форму) призводить до того, що він помилково спаровується з тиміном замість цитозину. Після двох раундів реплікації пара G-C остаточно замінюється на A-T, перетворюючи ATGCTT на ATACTT."
    },
    {
        q: "67.) Pharming is:",
        options: [
            "a) the production of biomolecules by transgenic plants or animals"
        ],
        correct: [0],
        explanation: "\"Фармінг\" (від слів farming та pharmaceutical) — це використання генетично модифікованих (трансгенних) сільськогосподарських рослин або тварин як біореакторів для масового виробництва фармацевтичних препаратів чи інших цінних біомолекул."
    },
    {
        q: "68.) Radioactively labeled phages (experiment by Hershey and Chase) show:",
        options: [
            "a) that bacterial DNA gets into the phages",
            "b) that bacterial proteins get into the phages",
            "c) the phage DNA enters the bacterial cell"
        ],
        correct: [2],
        explanation: "Знаменитий експеримент Герші та Чейз (1952 р.) із радіоактивно міченими бактеріофагами довів, що всередину бактеріальної клітини потрапляє саме вірусна ДНК (яка несе генетичну інформацію), тоді як білкова оболонка фага залишається зовні."
    },
    {
        q: "69.) Deletion mapping:",
        options: [
            "a) is the localization of chromosomal loci at which translations occur",
            "b) can be performed on the giant chromosomes of Drosophila",
            "c) is the localization of genes by correlating chromosome piece losses with",
            "d) mutant phenotypes",
            "e) could determine the position of the SRY locus on the male Y chromosome"
        ],
        correct: [1, 2, 3, 4],
        explanation: "Делеційне картування — це метод локалізації генів, який зіставляє втрату певних ділянок хромосоми (делеції) з появою мутантного фенотипу. Його зручно проводити на гігантських (політенних) хромосомах дрозофіли. Також цей метод допоміг знайти ген SRY на Y-хромосомі."
    },
    {
        q: "70.) Tick correct statements:",
        options: [
            "a) DNA sequencing by base-specific chemical cleavage is a 'sequences-by-synthesis' approach",
            "b) with the conventional Sanger method, approx. 1000 bases long sequences can be read in one pass",
            "c) Sequencing by chain termination (Sanger sequencing) uses dideoxynucleotides",
            "d) in automated Sanger sequencing, DNA fragments of different lengths are registered as they pass through a fluorescence detector"
        ],
        correct: [1, 2, 3],
        explanation: "Метод Сенгера (метод обриву ланцюга) використовує дидезоксинуклеотиди (ddNTP) і дозволяє прочитати близько 800-1000 баз за один раз. Автоматизований метод реєструє флуоресцентні мітки. Хімічне розщеплення (метод Максама-Гілберта) НЕ є підходом «секвенування шляхом синтезу»."
    },
    {
        q: "71.) Pyrimidine bases include:",
        options: [
            "a) Guanine",
            "b) Uracil",
            "c) Cytosine",
            "d) Thymine",
            "e) Adenine"
        ],
        correct: [1, 2, 3],
        explanation: "До піримідинових основ (молекули з одним кільцем) належать цитозин (C), тимін (T, зустрічається в ДНК) та урацил (U, зустрічається в РНК). Аденін та гуанін — це пурини."
    },
    {
        q: "72.) Garden peas were favourable for Mendel's studies because:",
        options: [
            "a) the phenotype in the F2 always showed 1:1",
            "b) they are self pollinators",
            "c) mutations can be easily produced",
            "d) there are many lines with easily distinguishable discrete features"
        ],
        correct: [1, 3],
        explanation: "Горох був ідеальним модельним об'єктом для Менделя, оскільки це рослина, що самозапилюється (що дозволяє легко створювати чисті лінії), і має багато різновидів з чіткими, дискретними ознаками (наприклад, жовті/зелені насінини, зморшкуваті/гладкі)."
    },
    {
        q: "73.) Tick correct statements:",
        options: [
            "a) cloned piglets get mitochondrial genes from surrogate mother",
            "b) in in vivo somatic gene therapy, functional genes are introduced directly into the target cell using vectors",
            "c) genes repaired by somatic gene therapy are passed on to the offspring",
            "d) XNAs are artificial variants of natural DNA and RNA"
        ],
        correct: [1, 3],
        explanation: "При in vivo соматичній генній терапії гени доставляються безпосередньо в клітини пацієнта (наприклад, вірусними векторами). XNA — це штучні аналоги нуклеїнових кислот. Мутації соматичних клітин НЕ передаються нащадкам. Клоновані тварини отримують мітохондрії від донора яйцеклітини, а не сурогатної матері."
    },
    {
        q: "74.) How many reading frames of a DNA sequence must be searched to find a possible open reading frame:",
        options: [
            "a) 8",
            "b) 4",
            "c) 6",
            "d) 2"
        ],
        correct: [2],
        explanation: "ДНК складається з двох комплементарних ланцюгів. Оскільки зчитування може починатися з 1-го, 2-го або 3-го нуклеотиду (через триплетний код), кожен ланцюг має 3 рамки зчитування. Загалом їх 6 (3 на прямому і 3 на зворотному ланцюзі)."
    },
    {
        q: "75.) A complementation test shows:",
        options: [
            "a) Whether a material is inherited extrachromosomally",
            "b) Whether two alleles are incompletely dominant or codominant",
            "c) Whether two mutations with the same phenotype affect the same gene",
            "d) Whether horizontal gene transfer is present"
        ],
        correct: [2],
        explanation: "Тест на комплементацію дозволяє генетикам з'ясувати, чи дві рецесивні мутації, що викликають однаковий фенотип, локалізовані в одному й тому ж гені (тоді потомство буде мутантним), чи в різних генах (тоді потомство матиме нормальний фенотип завдяки комплементації)."
    },
    {
        q: "76.) Transposons:",
        options: [
            "a) can cause gene disruption",
            "b) can change their position in the gene",
            "c) cause base substitutions",
            "d) always cause hereditary mutations"
        ],
        correct: [0, 1],
        explanation: "Транспозони (\"стрибаючі гени\") здатні змінювати своє положення в геномі. Якщо вони вставляються всередину функціонального гена, вони можуть повністю порушити його роботу (gene disruption). Вони не завжди викликають спадкові мутації, оскільки можуть стрибати і в соматичних клітинах."
    },
    {
        q: "77.) Gene Regulation. Tick the correct statements:",
        options: [
            "a) Enhancers are transcription enhancers located directly downstream of the promoter",
            "b) The preinitiation complex binds to the core promoter",
            "c) Histone acetylation may promote transcription factor binding",
            "d) Chromatin remodeling is the repositioning or removal of nucleosomes"
        ],
        correct: [1, 2, 3],
        explanation: "Преініціаторний комплекс дійсно зв'язується з кор-промотором (наприклад, TATA-боксом). Ацетилювання гістонів і ремоделювання хроматину розпушують ДНК, роблячи її доступною для факторів транскрипції. Енхансери можуть знаходитися на величезних відстанях від промотора, а не тільки безпосередньо за ним."
    },
    {
        q: "78.) Tick correct statements:",
        options: [
            "a) In C.elegans, approximately 90% of the cells of the embryo undergo apoptosis",
            "b) Pair Rule genes are active in human embryos",
            "c) The Notch gene encodes an intracellular signal transmitter",
            "d) The bithorax gene complex is responsible for the formation of thorax and abdomen."
        ],
        correct: [3],
        explanation: "Комплекс генів bithorax (Hox-гени) у дрозофіли відповідає за правильний розвиток задньої частини грудей (торакс) і черевця (абдомен). У C. elegans апоптозу піддаються лише близько 131 клітини (менше 15%, а не 90%)."
    },
    {
        q: "79.) Tick correct statements:",
        options: [
            "a) Plasmids can replicate independently of the bacterial chromosome",
            "b) When the F factor integrates into the bacterial chromosome, the cell becomes hfr",
            "c) a merocygote is a bacterium without F-factor",
            "d) When transferring the F factor from F+ to F- the transferring cell F+ remains"
        ],
        correct: [0, 1, 3],
        explanation: "Плазміди реплікуються автономно. Вбудовування F-фактора у хромосому створює Hfr-клітину (висока частота рекомбінації). Під час кон'югації донорська F+ клітина синтезує і передає копію, тому сама залишається F+. Мерозигота — це частково диплоїдна бактерія."
    },
    {
        q: "80.) Tick correct statements:",
        options: [
            "a) XX maleness denotes individuals with female sex chromosomes but sterile male phenotype",
            "b) Hypertrichosis (heavy hair growth) on the ears is caused by one of the few Y-chromosomal genes",
            "c) Females with three X chromosomes have two Barr bodies in their nuclei"
        ],
        correct: [0, 1, 2],
        explanation: "Синдром ХХ-чоловіків (синдром де ля Шапеля) дає чоловічий фенотип, але призводить до безпліддя. Гіпертрихоз вух — класичний приклад Y-зчепленої ознаки. При синдромі трипло-Х (ХХХ) інактивуються дві Х-хромосоми, утворюючи два тільця Барра."
    },
    {
        q: "81.) The clone cat CC:",
        options: [
            "a) differs from her genetic mother in coat patterning",
            "b) differs from her surrogate mother in the coat pattern",
            "c) does not differ from her genetic mother in coat patterning",
            "d) does not differ from her surrogate mother in coat patterning"
        ],
        correct: [0],
        explanation: "Клонована кішка CC (Carbon Copy) мала інший малюнок шерсті порівняно зі своєю генетичною матір'ю. Це сталося через випадкову інактивацію Х-хромосоми (утворення тілець Барра) під час ембріонального розвитку, що визначає розподіл кольорових плям у черепахових кішок."
    },
    {
        q: "82.) If you cross horse (mother) x donkey (father) or vice versa, you get different looking animals. Contributing to the differences:",
        options: [
            "a) genetic imprinting",
            "b) mitochondrial inheritance",
            "c) chromosomal polymorphisms",
            "d) X-linked genes (in males)"
        ],
        correct: [0, 1, 3],
        explanation: "Різниця між мулом (мати-кінь, батько-віслюк) та лошаком (мати-віслюк, батько-кінь) зумовлена геномним імпринтингом (різна експресія генів залежно від того, від кого вони успадковані), материнською мітохондріальною спадковістю та Х-зчепленими генами (які сини отримують лише від матері)."
    },
    {
        q: "83.) Terms used in genetic engineering. Tick the correct statements:",
        options: [
            "a) Transfection is the introduction of foreign DNA into animal cells",
            "b) Gene tagging is the reduction of the expression of a gene",
            "c) Gene knockin is the horizontal transfer of genes between organisms",
            "d) Genome editing refers to the modification of DNA by endonucleases in vitro"
        ],
        correct: [0],
        explanation: "Трансфекція — це процес штучного введення чужорідної нуклеїнової кислоти (ДНК або РНК) в еукаріотичні (зокрема тваринні) клітини. Gene tagging — це додавання мітки, а не зниження експресії."
    },
    {
        q: "84.) The knock-off technique (replica plating) serves this:",
        options: [
            "a) Transfer of DNA in a gene to a membrane",
            "b) Transfer of yeast colonies from one Petri dish to another.",
            "c) Transfer of bacterial colonies from one Petri dish to another",
            "d) Transfer of proteins in a gel to a membrane"
        ],
        correct: [1, 2],
        explanation: "Метод реплік (replica plating, в німецькій літературі іноді 'Stempeltechnik' / knock-off) використовується для перенесення точних копій колоній бактерій або дріжджів з однієї чашки Петрі на інші (наприклад, з різними антибіотиками) за допомогою оксамитового штампа."
    },
    {
        q: "85.) On the Ames test:",
        options: [
            "a) If auxotrophic bacterial mutants become wild-type by a new mutation",
            "b) Are bacteria killed by mutagens",
            "c) If the mutagenic effect of radioactive radiation is investigated",
            "d) If mutant bacteria are incubated with mutagens and liver extract"
        ],
        correct: [0, 3],
        explanation: "У тесті Еймса ауксотрофні бактеріальні мутанти (які не можуть синтезувати гістидин) піддаються впливу потенційного мутагену. Якщо вони зазнають зворотної мутації і стають диким типом, речовина є мутагенною. Також додають екстракт печінки для імітації метаболізму ссавців."
    },
    {
        q: "86.) In sexual reproduction:",
        options: [
            "a) species and individual characteristics remain constant over generations",
            "b) vary species characteristics between generations",
            "c) Individual characteristics vary between generations",
            "d) Species characteristics remain constant over generations"
        ],
        correct: [2, 3],
        explanation: "При статевому розмноженні видові ознаки (наприклад, кількість кінцівок, будова тіла) залишаються сталими з покоління в покоління. Однак індивідуальні ознаки змінюються завдяки генетичній рекомбінації (кросинговеру та випадковому розходженню хромосом)."
    },
    {
        q: "87.) A population is in Hardy-Weinberg equilibrium if:",
        options: [
            "a) no mutations take place",
            "b) they are reproductively isolated from other populations",
            "c) Allele frequency and allele distribution remain the same in successive generations",
            "d) positive selection works"
        ],
        correct: [0, 1, 2],
        explanation: "Популяція знаходиться в рівновазі Гарді-Вайнберга, якщо в ній немає мутацій, міграцій (вона ізольована), природного добору (селекції), популяція має великий розмір, а схрещування випадкове. Тоді частоти алелів залишаються незмінними."
    },
    {
        q: "88.) Tick correct statements:",
        options: [
            "a) the tRNA genes are present in the nucleus as tandem repeats",
            "b) the nucleolus is formed at the chromosome ends",
            "c) ribosomal RNA is transcribed and processed in the nucleolus",
            "d) the nucleolus is a constriction in the interphase chromatin"
        ],
        correct: [2],
        explanation: "Ядерце (nucleolus) — це щільна структура всередині ядра, де відбувається активна транскрипція генів рибосомної РНК (рРНК) та початкова збірка субодиниць рибосом."
    },
    {
        q: "89.) Genomics:",
        options: [
            "a) Orthologous proteins retain the same function in different species",
            "b) Tautology Proteins of one species are of the same origin but have assumed different functions",
            "c) Paralogous proteins have similar sequences and functions but no common evolutionary origin",
            "d) Protologous proteins have the same evolutionary origin"
        ],
        correct: [0],
        explanation: "Ортологічні білки (гени) походять від спільного предка через видоутворення і зазвичай зберігають однакову функцію в різних видів. Паралогічні білки виникають через дуплікацію генів і часто набувають нових функцій."
    },
    {
        q: "90.) In the cross P red flowers (RR) x P white flowers (rr), with incomplete dominance, the proportion of pink flowers is in the F2 generation:",
        options: [
            "a) 100%",
            "b) 75%",
            "c) 50%",
            "d) 25%"
        ],
        correct: [2],
        explanation: "При неповному домінуванні схрещування гетерозигот F1 (Rr x Rr, які всі рожеві) дає в поколінні F2 розщеплення 1:2:1. Отже, 25% будуть червоними (RR), 50% — рожевими (Rr) і 25% — білими (rr)."
    },
    {
        q: "91.) Tick correct statements:",
        options: [
            "a) there are 20 different tRNAs",
            "b) due to the wobble effect, different amino acids can bind to the same tRNA",
            "c) different mRNA triplets can bind the same tRNA",
            "d) Amino acids bind to the 5'end of the tRNA via a hydrogen bond"
        ],
        correct: [2],
        explanation: "Завдяки ефекту «хитання» (wobble effect) третя основа антикодону тРНК може утворювати нестандартні пари з основами кодону мРНК. Це дозволяє одній тРНК розпізнавати кілька різних кодонів (мРНК триплетів), які кодують ту саму амінокислоту."
    },
    {
        q: "92.) What is the main risk factor for the occurrence of a recessive hereditary disease:",
        options: [
            "a) Higher age of the mother",
            "b) Marriage among relatives",
            "c) Higher age of the father",
            "d) somatic mutations"
        ],
        correct: [1],
        explanation: "Близькоспоріднені шлюби (інбридинг) значно підвищують імовірність того, що обоє батьків будуть гетерозиготними носіями одного й того ж рецесивного мутантного алеля, отриманого від їхнього спільного предка."
    },
    {
        q: "93.) Tick correct statements:",
        options: [
            "a) in the leptotene of meiosis the homologs are completely paired",
            "b) homologous chromosomes separate in anaphase 2 of meiosis",
            "c) in metaphase 1 of meiosis, chromatids arrange themselves with their centromeres in the equatorial plane",
            "d) in the diakinesis of meiosis the chromosomes are maximally shortened"
        ],
        correct: [3],
        explanation: "У стадії діакінезу профази I мейозу хромосоми досягають максимальної конденсації (вкорочення). Гомологічні хромосоми розходяться в анафазі I (а не II), а повне спаровування відбувається в пахітені."
    },
    {
        q: "94.) Tick correct statements:",
        options: [
            "a) The polynucleotide chains of the DNA wrap around each other in a clockwise direction",
            "b) The sugar-phosphate backbone is located on the inside of the DNA double helix",
            "c) One turn of the DNA double helix contains about 10 base pairs",
            "d) The two polynucleotide chains of the DNA run antiparallel"
        ],
        correct: [0, 2, 3],
        explanation: "Класична подвійна спіраль ДНК (В-форма) закручена вправо (за годинниковою стрілкою), має антипаралельні ланцюги і містить близько 10 пар основ на один виток. Цукрово-фосфатний остов знаходиться зовні, а азотисті основи — всередині."
    },
    {
        q: "95.) In clonal propagation:",
        options: [
            "a) species characteristics and individual characteristics remain constant",
            "b) only species characteristics remain constant over generations",
            "c) vary species characteristics between generations",
            "d) Individual characteristics vary between generations"
        ],
        correct: [0],
        explanation: "При клональному (вегетативному, нестатевому) розмноженні нащадки є точними генетичними копіями (клонами) материнського організму. Тому як видові, так і індивідуальні ознаки залишаються сталими з покоління в покоління."
    },
    {
        q: "96.) Tick correct statements:",
        options: [
            "a) the eukaryotic RNAP II transcribes mRNA",
            "b) in eukaryotes, transcription and translation are spatially separated",
            "c) translation starts about 150 bases downstream from the initiator region",
            "d) the TATA box is part of the eukaryotic core promoter",
            "e) the Kozak sequence is part of the eukaryotic transcription enhancer"
        ],
        correct: [0, 1, 3],
        explanation: "РНК-полімераза II синтезує мРНК. В еукаріотів транскрипція відбувається в ядрі, а трансляція — в цитоплазмі (просторово розділені). TATA-бокс є частиною кор-промотора. (Послідовність Козак важлива для трансляції, а не транскрипції)."
    },
    {
        q: "97.) Tick correct statements:",
        options: [
            "a) Prototrophic bacteria require essential salts for growth",
            "b) Plaques are the visible bacterial colonies on petri dishes",
            "c) Auxotrophic bacteria can only grow in liquid cultures",
            "d) the ring-shaped bacterial DNA is located inside the cell in the nucellus"
        ],
        correct: [0],
        explanation: "Прототрофні бактерії можуть синтезувати всі необхідні органічні речовини з простих солей і джерела вуглецю (наприклад, глюкози) у мінімальному середовищі. Бляшки (plaques) — це не колонії, а прозорі зони, де бактеріофаги вбили бактерії. ДНК бактерій знаходиться в нуклеоїді, а не нуцелусі."
    },
    {
        q: "98.) What is true of Spo11:",
        options: [
            "a) Spo11 induces DNA double-strand breaks in meiosis"
        ],
        correct: [0],
        explanation: "Білок Spo11 ініціює кросинговер під час мейозу шляхом створення запрограмованих дволанцюгових розривів (DSB) у ДНК."
    },
    {
        q: "99.) Gene Regulation. Tick the correct statements:",
        options: [
            "a) one polycistronic mRNA encodes several proteins",
            "b) Tryptophan synthesis is an example of positive gene regulation in bacteria",
            "c) The Pribnow box is a consensus sequence to which the PolyA is attached",
            "d) The operon is the sequence between promoter and translation start codon"
        ],
        correct: [0],
        explanation: "Поліцистронна мРНК (характерна для бактерій) містить інформацію для синтезу кількох різних білків. Оперон триптофану — це приклад негативної (а не позитивної) репресивної регуляції. Прибнов-бокс (-10 послідовність) — це частина промотора бактерій."
    },
    {
        q: "100.) Tick correct statements:",
        options: [
            "a) The transcriptome is the set of genes transcribed in a particular tissue or developmental stage of an organism",
            "b) The reference genome describes the complete set of genes and sequence polymorphs of a species",
            "c) The genome of a cell is regulated depending on the developmental stage, cell type and tissue as well as environmental influences"
        ],
        correct: [0, 2],
        explanation: "Транскриптом — це сукупність усіх молекул РНК (транскриптів), активних у даний момент. Експресія генів (регуляція геному) строго залежить від типу клітини, стадії розвитку та середовища. Референсний геном — це єдиний стандарт (еталон), він не описує всі можливі поліморфізми (це робить пангеном)."
    },
    {
        q: "101.) Tick correct statements:",
        options: [
            "a) Plasmids consist of double-stranded circular DNA",
            "b) Col plasmids carry resistance factors to antibiotics",
            "c) Bacteria with the F factor can form sexpilli"
        ],
        correct: [0, 2],
        explanation: "Плазміди — це зазвичай дволанцюгові кільцеві молекули ДНК. Бактерії з F-фактором (фертильності) здатні утворювати статеві пілі для кон'югації. (Стійкість до антибіотиків несуть R-плазміди, тоді як Col-плазміди кодують коліцини — токсини проти інших бактерій)."
    },
    {
        q: "102.) Tick correct statements:",
        options: [
            "a) A deletion can turn a prototype oncogene into an oncogene",
            "b) Proto-oncogenes can be transcription factors",
            "c) Proto-oncogenes have a role in DNA break repair",
            "d) Mutations in tumor suppressor genes are dominant"
        ],
        correct: [0, 1],
        explanation: "Делеція (наприклад, втрата регуляторного домену) може перетворити нормальний протоонкоген на гіперактивний онкоген. Багато протоонкогенів (наприклад, Myc) є факторами транскрипції. Мутації генів-супресорів пухлин зазвичай рецесивні на клітинному рівні."
    },
    {
        q: "103.) Originally, the wrong view prevailed that proteins can be the carriers of the hereditary material because:",
        options: [
            "a) Proteins can switch between the nucleus and the cytoplasm",
            "b) DNA is a simple molecule consisting of four identical building blocks.",
            "c) Proteins are complex chains of amino acids",
            "d) DNA occurs not only in cell nuclei but also in mitochondria"
        ],
        correct: [1, 2],
        explanation: "До відкриття ролі ДНК вчені вважали, що генетична інформація зберігається в білках, оскільки білки дуже складні (побудовані з 20 різних амінокислот), тоді як ДНК здавалася занадто простою і одноманітною молекулою (лише 4 типи нуклеотидів)."
    },
    {
        q: "104.) The Cre/Lox System. Tick the correct statements:",
        options: [
            "a) A gene of interest located between two Cre sequences can be removed by floxing",
            "b) The Cre/Lox system is used to produce transgenic mice",
            "c) The recombinase Cre specifically cuts into the LoxP sequence",
            "d) The Cre/Lox system is used to produce conditional mutants"
        ],
        correct: [1, 2, 3],
        explanation: "Система Cre/Lox використовується для створення умовних нокаутів у мишей. Фермент Cre-рекомбіназа розпізнає специфічні сайти LoxP (а не сайти Cre) і вирізає ДНК між ними. Цей процес називається флоксуванням (floxing)."
    },
    {
        q: "105.) The Pronto-Oncogene c-MYC:",
        options: [
            "a) may be highly amplified as 'double minutes'",
            "b) can be overexpressed by a translocation",
            "c) can suppress apoptosis of hyperpoliferating cells",
            "d) is a DNA repair protein"
        ],
        correct: [0, 1],
        explanation: "Онкоген c-MYC може бути ампліфікований у вигляді екстрахромосомних елементів (double minutes) або надекспресований через транслокацію (як при лімфомі Беркітта). Він є фактором транскрипції, а не білком репарації ДНК."
    },
    {
        q: "106.) An Enhancer Screen:",
        options: [
            "a) Enhances the effect of a mutation by irradiation or chemical substances",
            "b) Searches for loss of function mutations",
            "c) can elucidate redundancies between genes",
            "d) searches for mutations that enhance an existing mutant phenotype"
        ],
        correct: [2, 3],
        explanation: "Енхансерний скринінг — це генетичний метод, який шукає вторинні мутації, що посилюють фенотип уже існуючої мутації. Це допомагає виявити гени, які працюють у тому ж біологічному шляху або частково дублюють функції один одного (надмірність)."
    },
    {
        q: "107.) Which cross produces 100% F1 progeny with the dominant phenotype:",
        options: [
            "a) heterozygous (Aa) x homozygous recessive (aa)",
            "b) homozygous dominant (AA) x homozygous recessive (aa)",
            "c) homozygous dominant (AA) x heterozygous (Aa)",
            "d) heterozygous (Aa) x heterozygous (Aa)"
        ],
        correct: [1, 2],
        explanation: "Схрещування AA x aa дає 100% гетерозигот (Aa), які всі мають домінантний фенотип. Схрещування AA x Aa дає 50% AA та 50% Aa, що також означає 100% потомства з домінантним фенотипом."
    },
    {
        q: "108.) Metagenomics:",
        options: [
            "a) Describes a method for the isolation of phage DNA",
            "b) Is a discipline that lies between genomics and ethical ecology",
            "c) Sequences DNA from environmental samples",
            "d) Assigns MO according to their protein size"
        ],
        correct: [2],
        explanation: "Метагеноміка — це розділ генетики, який вивчає генетичний матеріал, отриманий безпосередньо зі зразків навколишнього середовища (наприклад, ґрунту, води або кишечника), без необхідності культивування мікроорганізмів у лабораторії."
    },
    {
        q: "109.) Metagenomics:",
        options: [
            "a) compares the DNA sequence of tumor and healthy cells",
            "b) investigates which portion of the genome is transcribed",
            "c) Investigates the effect of environmental influences on the genome",
            "d) Sequences DNA from environmental samples"
        ],
        correct: [3],
        explanation: "Як і в попередньому питанні, метагеноміка полягає у секвенуванні загальної ДНК зразків навколишнього середовища (мікробіому)."
    },
    {
        q: "110.) Foreign DNA can be introduced into cells by:",
        options: [
            "a) RNA interference",
            "b) Microinjection",
            "c) Bombardment of DNA-loaded neomycin particles.",
            "d) Electroporation"
        ],
        correct: [1, 3],
        explanation: "Мікроін'єкція та електропорація — це фізичні методи введення чужорідної ДНК у клітини. (Біолістична гармата використовує частинки золота або вольфраму, а не неоміцину, який є антибіотиком)."
    },
    {
        q: "111.) Genome Editing (Fok1):",
        options: [
            "a) Fok1 is a nuclease",
            "b) one amino acid each in the transcription activator like effector (TALE) recognizes a sequence of 22-23 bp in the target DNA",
            "c) Fok1 is a restriction enzyme",
            "d) Fok1 can only cut near the PAM sequence"
        ],
        correct: [0, 2],
        explanation: "FokI — це ендонуклеаза (рестриктаза), яка використовується в методах редагування геному, таких як TALEN та ZFN, для створення дволанцюгових розривів. (PAM-послідовність потрібна для Cas9, а не для FokI; а модулі TALE розпізнають по одному нуклеотиду, а не 22-23 bp кожен)."
    },
    {
        q: "112.) Tick correct statements:",
        options: [
            "a) PCR is an in vivo method for DNA amplification",
            "b) FISH can be used to localize a specific DNA sequence on chromosomes",
            "c) a thermostable ligase is required for PCR",
            "d) a reverse transcriptase is required for the synthesis of cDNA"
        ],
        correct: [1, 3],
        explanation: "FISH (флуоресцентна гібридизація in situ) використовується для локалізації генів на хромосомах. Зворотна транскриптаза потрібна для створення кДНК (cDNA) на матриці РНК. (ПЛР — це метод in vitro, і для нього потрібна термостабільна полімераза, а не лігаза)."
    },
    {
        q: "113.) Tick correct statements:",
        options: [
            "a) Stop codons are the signal for the termination of transcription",
            "b) Redundancy means that a triplet can code for several different ASs",
            "c) there are exceptions to the universality of the genetic code",
            "d) the genetic code is unique"
        ],
        correct: [2, 3],
        explanation: "Генетичний код є однозначним (unique / unambiguous — один кодон завжди кодує лише одну амінокислоту) і має винятки з універсальності (наприклад, у мітохондріях). Стоп-кодони зупиняють трансляцію, а не транскрипцію. Надмірність (виродженість) означає, що кілька різних кодонів кодують ОДНУ амінокислоту, а не навпаки."
    },
    {
        q: "114.) Replication is more complex in eukaryotes than in prokaryotes because:",
        options: [
            "a) in eukaryotes DNA synthesis can only occur in the 5'-3' direction",
            "b) in eukaryotes, the newly synthesized strand is proofread",
            "c) Eukaryotic chromosomes linear are",
            "d) Eukaryotic DNA present in chromatin"
        ],
        correct: [2, 3],
        explanation: "Реплікація в еукаріотів складніша, оскільки їхні хромосоми лінійні (що створює проблему недореплікації кінців — потрібна теломераза), а ДНК щільно упакована в хроматин (потрібно розбирати та збирати нуклеосоми). Напрямок 5'-3' та виправлення помилок (proofreading) однакові і для бактерій."
    },
    {
        q: "115.) When two genes contribute additively to a quantitative trait, AABB x aabb is found in the F2-generation after a cross:",
        options: [
            "a) 5 phenotypically distinguishable classes",
            "b) 1/16 of the offspring with an extreme phenotype",
            "c) 3 phenotypically distinguishable classes",
            "d) 100% of progeny with the same intermediate phenotype as F1."
        ],
        correct: [0, 1],
        explanation: "При полімерному (адитивному) успадкуванні двох генів у поколінні F2 утворюється 5 фенотипових класів (співвідношення 1:4:6:4:1 залежно від кількості домінантних алелів). Крайні фенотипи (AABB або aabb) зустрічаються з частотою 1/16 кожен."
    },
    {
        q: "116.) Tick correct statements:",
        options: [
            "a) The yeast tetrads can be separated by electrophoresis",
            "b) The product of yeast meiosis is 4 haploid zygotes",
            "c) Baker's yeast can reproduce vegetatively and sexually",
            "d) vegetative propagation in yeast occurs by sporulation"
        ],
        correct: [2],
        explanation: "Пекарські дріжджі (S. cerevisiae) можуть розмножуватися як вегетативно (брунькуванням, а не споруляцією), так і статевим шляхом (з утворенням гаплоїдних спор, а не зигот). Тетради розділяють мікроманіпулятором, а не електрофорезом."
    },
    {
        q: "117.) In the S phase of the cell cycle:",
        options: [
            "a) the dividing spindle is formed",
            "b) the chromatin is loosened",
            "c) persist non-dividing cells",
            "d) DNA is replicated"
        ],
        correct: [3],
        explanation: "S-фаза (фаза синтезу) клітинного циклу — це час, коли відбувається реплікація (подвоєння) ДНК. Веретено поділу формується в М-фазі, а клітини, що не діляться, знаходяться у фазі G0."
    },
    {
        q: "118.) Tick correct statements:",
        options: [
            "a) Cyclins are ring-shaped protein complexes",
            "b) Cohesins connect sister chromatids",
            "c) Condensins are ring-shaped protein complexes",
            "d) Cohesins are ring-shaped protein complexes"
        ],
        correct: [1, 2, 3],
        explanation: "Когезини та конденсини — це великі кільцеподібні білкові комплекси. Когезини утримують сестринські хроматиди разом до анафази, а конденсини допомагають упакувати хромосоми під час мітозу. Цикліни не є кільцеподібними, вони лише регулюють кінази."
    },
    {
        q: "119.) Exception(s) to the Central Dogma are:",
        options: [
            "a) Genetic imprinting",
            "b) RNA viruses",
            "c) Paramutations",
            "d) Telomeric reverse transcriptase (telomerase)"
        ],
        correct: [1, 3],
        explanation: "Центральна догма стверджує, що інформація передається від ДНК до РНК, а потім до білка. Винятками є РНК-віруси (наприклад, ретровіруси) та теломераза (яка є зворотною транскриптазою), оскільки вони можуть переписувати інформацію з РНК назад у ДНК."
    },
    {
        q: "120.) Chromosomal structural heterozygotes:",
        options: [
            "a) disrupt the meiotic segregation",
            "b) disrupt the meiotic mating",
            "c) disrupt replication",
            "d) Hybrids become fertile"
        ],
        correct: [0, 1],
        explanation: "Структурні гетерозиготи (особини, у яких одна хромосома нормальна, а гомологічна містить інверсію або транслокацію) мають проблеми під час мейотичного спаровування (утворюють петлі або хрести) і часто мають порушення розходження хромосом, що призводить до часткового безпліддя."
    },
    {
        q: "121.) Risk factors for tumor diseases are:",
        options: [
            "a) Hereditary predisposition to high blood pressure",
            "b) Phages",
            "c) DNA viruses",
            "d) Consumption of unsaturated fatty acids"
        ],
        correct: [2],
        explanation: "Деякі ДНК-віруси (наприклад, вірус папіломи людини ВПЛ, вірус гепатиту В) є доведеними онкогенними факторами ризику, що можуть викликати рак. (Бактеріофаги вражають лише бактерії)."
    },
    {
        q: "122.) DNA DSB are repaired by:",
        options: [
            "a) Photoactivation",
            "b) Base Excision Repair",
            "c) Non-homologous End Joining",
            "d) Recombination repair"
        ],
        correct: [2, 3],
        explanation: "Дволанцюгові розриви ДНК (DSB) є дуже небезпечними і ремонтуються двома основними шляхами: негомологічним з'єднанням кінців (NHEJ) та репарацією за допомогою гомологічної рекомбінації (HR)."
    },
    {
        q: "123.) Tick correct statements:",
        options: [
            "a) Incorporation of an insert to be cloned linearizes a plasmid",
            "b) Chromatids and cosmids are artificial cloning vectors",
            "c) Plasmids as vectors can typically accommodate about 10-15 base pairs of inserts",
            "d) YAC's can usually accommodate larger listings than BAC's"
        ],
        correct: [3],
        explanation: "Штучні хромосоми дріжджів (YACs) мають набагато більшу ємність для вставок (до 1000 кб), ніж бактеріальні штучні хромосоми (BACs, близько 100-300 кб). (Плазміди вміщують кілобази, а не просто 10-15 пар основ)."
    },
    {
        q: "124.) The interference of crossovers means that:",
        options: [
            "a) Suppress crossovers in hotspots, crossovers in coldspots",
            "b) The probability of recombination in adjacent gene intervals is lowered",
            "c) Crossovers near centromeres or telomeres are suppressed",
            "d) Crossovers suppress the formation of further crossovers in their neighborhoods"
        ],
        correct: [1, 3],
        explanation: "Генетична інтерференція — це явище, при якому один кросинговер (обмін ділянками) пригнічує утворення іншого кросинговеру безпосередньо поблизу нього, що знижує ймовірність подвійної рекомбінації в сусідніх інтервалах."
    },
    {
        q: "125.) Advantages of mutants by genome editing over conventional GMO's:",
        options: [
            "a) Production does not require embryonic stem cells",
            "b) Also works for plants",
            "c) no demonstrable difference to naturally occurring mutations",
            "d) cheaper"
        ],
        correct: [0, 2, 3],
        explanation: "Сучасне редагування геному (наприклад, CRISPR/Cas9) часто не залишає чужорідної ДНК (трансгенів), тому створені мутації часто неможливо відрізнити від природних. Воно також дозволяє вводити систему безпосередньо в зиготу (без ембріональних стовбурових клітин) і загалом є дешевшим і швидшим методом."
    },
    {
        q: "126.) Exception to Mendel's independence rule exist when:",
        options: [
            "a) Two genes are coupled",
            "b) Features are incompletely dominant",
            "c) One gene epistatic over the other is",
            "d) Two genes located close to each other on the same chromosome"
        ],
        correct: [0, 3],
        explanation: "Закон незалежного успадкування Менделя не працює, коли два гени фізично зчеплені (coupled), тобто розташовані дуже близько один до одного на одній хромосомі, через що вони успадковуються переважно разом."
    },
    {
        q: "127.) Inadequate crossing over can:",
        options: [
            "a) Cause reciprocal translocation",
            "b) Cause inversions",
            "c) Duplications and delegations cause",
            "d) Aneupoloidia cause"
        ],
        correct: [2],
        explanation: "Нерівний (неадекватний) кросинговер під час мейозу призводить до того, що одна хромосома отримує додаткову ділянку (дуплікація), а інша втрачає цю ділянку (делеція)."
    },
    {
        q: "128.) Tick correct statements:",
        options: [
            "a) Translation is the uptake of free DNA by bacteria",
            "b) All bacteria are transformable by nature",
            "c) Transduction is a unidirectional transfer of genetic material",
            "d) Transformation is the transfer of bacterial DNA by viruses as intermediate carriers"
        ],
        correct: [2],
        explanation: "Трансдукція — це односпрямована передача генетичного матеріалу між бактеріями за допомогою вірусів (фагів). (Поглинання вільної ДНК — це трансформація, а не трансляція. Не всі бактерії природно здатні до трансформації)."
    },
    {
        q: "129.) Eukaryotic pre-mRNA is post-transcriptionally modified by:",
        options: [
            "a) Acetylation",
            "b) 5'-polyadenylation",
            "c) 5' capping",
            "d) Splicing"
        ],
        correct: [2, 3],
        explanation: "Після транскрипції пре-мРНК еукаріотів піддається модифікаціям: додавання 5'-кепу (5' capping) для захисту, сплайсинг (видалення інтронів) та 3'-поліаденілювання. (У варіанті B помилка, поліаденілювання відбувається на 3'-кінці, а не на 5'-кінці)."
    },
    {
        q: "130.) A deletion can turn a proto-oncogene into an oncogene:",
        options: [
            "a) the RAS gene is a porto-oncogene",
            "b) the RAS protein can bind GTP",
            "c) the RAS protein is a transcription factor",
            "d) encodes a signal transduction molecule"
        ],
        correct: [0, 1, 3],
        explanation: "Ген RAS — це класичний протоонкоген, який кодує білок передачі сигналу (signal transduction molecule), що активується шляхом зв'язування з GTP. Він не є фактором транскрипції (фактори транскрипції діють у ядрі, а RAS — на мембрані)."
    },
    {
        q: "131.) For DNA replication is needed:",
        options: [
            "a) DNA polymerization",
            "b) an endonuclease",
            "c) a DNA matrix",
            "d) one RNA primer"
        ],
        correct: [0, 2, 3],
        explanation: "Для реплікації ДНК необхідні: ДНК-полімераза (для синтезу), матриця (материнський ланцюг ДНК) та РНК-праймери (щоб полімераза мала з чого почати синтез)."
    },
    {
        q: "132.) Watson and Crick have:",
        options: [
            "a) mutations induced in Drosophila",
            "b) rediscovered the Mendel rules",
            "c) the double helix structure of DNA proposed",
            "d) shown that the genetic information is located in the cell nucleus"
        ],
        correct: [2],
        explanation: "Джеймс Вотсон та Френсіс Крік у 1953 році запропонували знамениту модель подвійної спіралі ДНК, що пояснило, як зберігається і копіюється генетична інформація."
    },
    {
        q: "133.) Tick correct statements:",
        options: [
            "a) Selection improves the adaptation of a population",
            "b) Mutations improve the adaptation of a population",
            "c) Microevolution through gene flow easily results in the accidental loss of rare alleles",
            "d) Rare alleles can be enriched by the founder effect"
        ],
        correct: [0, 3],
        explanation: "Природний добір покращує адаптацію популяції до умов середовища. Ефект засновника (різновид генетичного дрейфу) може випадково зробити рідкісні алелі дуже поширеними в новій, ізольованій популяції."
    },
    {
        q: "134.) Tick correct statements:",
        options: [
            "a) The loss of 3 bases restores the original reading frame",
            "b) The gain of one base leads to a frameshift mutation",
            "c) The gain of 3 bases leads to a frameshift mutation",
            "d) The loss of 2 bases leads to a frameshift mutation"
        ],
        correct: [0, 1, 3],
        explanation: "Оскільки генетичний код є триплетним, додавання або втрата 1 чи 2 баз зсуває рамку зчитування (frameshift), повністю змінюючи всі наступні амінокислоти. Втрата або додавання рівно 3 баз зберігає загальну рамку, видаляючи або додаючи лише одну амінокислоту."
    },
    {
        q: "135.) In Prader-Willi syndrome:",
        options: [
            "a) the allele inherited from the father is active",
            "b) sick fathers always have healthy sons",
            "c) mothers with a defective allele can have sick children",
            "d) have sick persons healthy mothers"
        ],
        correct: [3],
        explanation: "При синдромі Прадера-Віллі батьківський (активний) алель втрачено або мутовано. Материнський алель у цьому регіоні завжди вимкнений (імпринтинг). Тому матері зазвичай здорові, але дитина хворіє через відсутність активної копії генів від батька."
    },
    {
        q: "136.) Tick correct statements:",
        options: [
            "a) in nature, restriction enzymes serve for the insertion of prophages",
            "b) Restriction enzymes cut palindromic sequences",
            "c) Lysozyme is a universal restriction enzyme",
            "d) Restriction enzymes are endonucleases"
        ],
        correct: [1, 3],
        explanation: "Рестриктази — це ендонуклеази бактерій, які впізнають специфічні паліндромні послідовності ДНК і розрізають їх. У природі вони слугують для захисту від фагової (вірусної) ДНК, руйнуючи її."
    },
    {
        q: "137.) Tick correct statements:",
        options: [
            "a) 10-15% of tumors use ALT to evade immune defense by T cells",
            "b) Metastasis triggers the expression of oncogenes",
            "c) Apoptosis stimulates DNA repair in tumors",
            "d) telomerase is active in most tumors"
        ],
        correct: [3],
        explanation: "Теломераза активна у понад 85-90% пухлин, що дозволяє раковим клітинам постійно відновлювати кінці своїх хромосом і ставати «безсмертними» (уникати старіння)."
    },
    {
        q: "138.) is a trigger for Huntington's disease:",
        options: [
            "a) Base substitution",
            "b) a nonsense mutation",
            "c) a deletion",
            "d) Trinucleotide expansion"
        ],
        correct: [3],
        explanation: "Хвороба Гантінгтона викликана експансією (патологічним збільшенням) кількості тринуклеотидних повторів (CAG) у гені HTT, що призводить до утворення токсичного білка."
    },
    {
        q: "139.) In the case of infection by phages:",
        options: [
            "a) Is bacteria DNA replicated",
            "b) If bacteria DNA is incorporated into the CRISPR complex of the phage",
            "c) Penetrates the phage particle into the bacterial cell",
            "d) Are phage proteins synthesized"
        ],
        correct: [3],
        explanation: "Під час фагової інфекції вірус використовує механізми бактерії для синтезу власних фагових білків (капсиду, ферментів) та реплікації своєї ДНК. (Сама частинка фага всередину не проникає, впорскується лише вірусна ДНК)."
    },
    {
        q: "140.) Which cross provides 75% F1 progeny with the dominant phenotype:",
        options: [
            "a) Homozygous dominant (AA) + Heterozygous (Aa)",
            "b) Heterozygous (Aa) + Homozygous recessive (aa)",
            "c) Heterozygous (Aa) + Heterozygous (Aa)",
            "d) Homozygous dominant (AA) + Homozygous recessive (aa)"
        ],
        correct: [2],
        explanation: "Схрещування двох гетерозигот (Aa x Aa) дає розщеплення фенотипів у співвідношенні 3:1 за законом Менделя. Це означає, що 75% нащадків (AA та Aa) матимуть домінантний фенотип, а 25% (aa) — рецесивний."
    },
    {
        q: "141.) Expression of alleles A, B, O for glycoprotein in erythrocyte membrane:",
        options: [
            "a) O dominant over A",
            "b) A incomplete dominant over B",
            "c) A-B codominant",
            "d) B dominant over O"
        ],
        correct: [2, 3],
        explanation: "У системі груп крові AB0 алелі A і B є кодомінантними (тобто обидва проявляються повністю і рівноправно у генотипі AB). Водночас обидва ці алелі є домінантними по відношенню до рецесивного алеля O."
    },
    {
        q: "142.) The original central dogma of genetic information flow states that information:",
        options: [
            "a) from the DNA to the RNA",
            "b) goes from the protein to the RNA",
            "c) from the DNA to the protein",
            "d) from the RNA to the protein goes"
        ],
        correct: [0, 3],
        explanation: "Центральна догма молекулярної біології, сформульована Френсісом Кріком, стверджує, що генетична інформація передається послідовно: від ДНК до РНК (транскрипція), а потім від РНК до білка (трансляція)."
    },
    {
        q: "143.) Triggers for achondroplasia are:",
        options: [
            "a) a missense mutation",
            "b) a nonsense mutation",
            "c) Trinucleotide expansion",
            "d) Base substitution"
        ],
        correct: [0, 3],
        explanation: "Ахондроплазія найчастіше викликається заміною однієї азотистої основи (base substitution), яка призводить до міссенс-мутації (заміна однієї амінокислоти на іншу) в гені FGFR3."
    },
    {
        q: "144.) The replication of DNA is:",
        options: [
            "a) Redundant",
            "b) Dispersive",
            "c) Semi-conservative",
            "d) Conservative"
        ],
        correct: [2],
        explanation: "Реплікація ДНК є напівконсервативною (semi-conservative): кожна нова подвійна спіраль складається з одного старого (материнського) ланцюга та одного щойно синтезованого дочірнього ланцюга."
    },
    {
        q: "145.) Aminoacyl-tRNA synthetase:",
        options: [
            "a) connects the large ribosome subunit with the small ribosome subunit",
            "b) binds the tRNA to an amino acid",
            "c) links the tRNA to the complementary mRNA sequence",
            "d) links the peptide bond in the ribosome"
        ],
        correct: [1],
        explanation: "Аміноацил-тРНК-синтетаза — це специфічний фермент, який розпізнає правильну амінокислоту і ковалентно приєднує її до відповідної молекули тРНК перед початком трансляції."
    },
    {
        q: "146.) Reasons for the 'Awesome Power of Yeast Genetics' are that in yeast:",
        options: [
            "a) The phenotype of recessive alleles in haploid cells can be studied",
            "b) The backcross gives an indication of the genotype of the meiosis product",
            "c) Lethal mutations can be propagated heterozygously in diploids",
            "d) all 4 products of one and the same meiosis can be studied",
            "e) for the production of homozygous mutants, a haploid mutant cell can be diploidized"
        ],
        correct: [0, 2, 3, 4],
        explanation: "Дріжджі (Saccharomyces cerevisiae) — ідеальний модельний організм. Вони можуть рости як гаплоїди (що дозволяє одразу бачити рецесивні мутації) та як диплоїди (що дозволяє зберігати летальні мутації). Крім того, всі 4 продукти мейозу залишаються разом у сумці (тетраді), що спрощує генетичний аналіз."
    },
    {
        q: "147.) Proofreading in DNA synthesis:",
        options: [
            "a) takes place through gyrase",
            "b) removes the RNA primers",
            "c) removes incorrectly inserted nucleotides",
            "d) is carried out by some DNA polymerases"
        ],
        correct: [2, 3],
        explanation: "Функція «вичитування» (proofreading) здійснюється самими ДНК-полімеразами. Вони використовують свою 3'→5' екзонуклеазну активність, щоб розпізнати та видалити помилково вставлені нуклеотиди під час синтезу ДНК."
    },
    {
        q: "148.) In the dihybrid cross AABB x aabb is obtained in the F2:",
        options: [
            "a) 16 different offspring",
            "b) 9 different genotypes",
            "c) Phenotypes in the ratio 3:1",
            "d) 4 different phenotypes"
        ],
        correct: [1, 3],
        explanation: "При класичному дигібридному схрещуванні (за третім законом Менделя) в поколінні F2 утворюється 9 різних генотипів і 4 різні фенотипи у знаменитому співвідношенні 9:3:3:1."
    },
    {
        q: "149.) CRISPR means:",
        options: [
            "a) condensed rapidly inserting single palindromic rearrangements",
            "b) condensed regularly inserted short palindromic reverts",
            "c) clustered regularly interspaced short palindromic repeats",
            "d) clustered rapidly interspaced short palindromic repeats"
        ],
        correct: [2],
        explanation: "CRISPR — це акронім, що розшифровується як Clustered Regularly Interspaced Short Palindromic Repeats (короткі паліндромні повтори, регулярно розташовані групами). Це частина бактеріальної імунної системи."
    },
    {
        q: "150.) Right Statements:",
        options: [
            "a) Immunodetection of proteins is performed with labeled antibodies"
        ],
        correct: [0],
        explanation: "Методи імунодетекції (наприклад, Вестерн-блот або імунофлуоресценція) дійсно базуються на використанні специфічних антитіл, які зв'язуються з цільовим білком. Антитіла часто мітять ферментами або флуоресцентними барвниками."
    },
    {
        q: "151.) Cytidine pairs with:",
        options: [
            "a) Guanosine",
            "b) Uracil",
            "c) Adenosine",
            "d) Thymidine"
        ],
        correct: [0],
        explanation: "За принципом комплементарності азотистих основ, цитозин (цитидин у формі нуклеозиду) завжди спаровується з гуаніном (гуанозином), утворюючи три водневі зв'язки."
    },
    {
        q: "152.) Gibbson Assembly is a method:",
        options: [
            "a) for the introduction of foreign DNA into target cells",
            "b) to create an ordered library",
            "c) for the enrichment of a purified protein",
            "d) for the connection of DNA fragments"
        ],
        correct: [3],
        explanation: "Збірка Гібсона (Gibson Assembly) — це потужний метод молекулярного клонування, який дозволяє легко та швидко з'єднувати (зшивати) кілька лінійних фрагментів ДНК в одну кільцеву молекулу в одній пробірці."
    },
    {
        q: "153.) Reasons why there may be more different proteins than genes are:",
        options: [
            "a) Alternative splicing",
            "b) Transcription of satellite DNA",
            "c) Somatic recombination of immunoglobulin genes.",
            "d) The large number of tRNA genes"
        ],
        correct: [0, 2],
        explanation: "В організмі людини близько 20 000 генів, але сотні тисяч білків. Це можливо завдяки альтернативному сплайсингу (один ген може давати різні мРНК) та соматичній рекомбінації (як у генах імуноглобулінів, що створює різноманіття антитіл)."
    },
    {
        q: "154.) Tick correct statements:",
        options: [
            "a) Cas nuclease makes double-strand breaks in the DNA of infecting phages",
            "b) in the acquisition phase, palindromic phage DNA is incorporated into the CRISPR region",
            "c) Protospacer Adjacent Motif (PAM) prevents Cas in the CRISPR region from avoiding",
            "d) in genetic engineering CRISPR Das is used for immunization of bacteria"
        ],
        correct: [0, 2],
        explanation: "Нуклеаза Cas (наприклад, Cas9) захищає бактерію, роблячи дволанцюгові розриви у ДНК вірусів (фагів). PAM (Protospacer Adjacent Motif) є критичним для розпізнавання цілі ферментом Cas, водночас він запобігає розрізанню власної ДНК бактерії."
    },
    {
        q: "155.) Tick correct statements:",
        options: [
            "a) In response to a cellular signal, the division activity of a cell may change",
            "b) Signal transduction occurs through the methylation of histones",
            "c) Cellular signal receptors are located in the nucleus",
            "d) At the end of the signal chain there is usually a transcription factor"
        ],
        correct: [0, 3],
        explanation: "Клітинні сигнали (наприклад, фактори росту) можуть стимулювати або пригнічувати поділ клітини. Сигнальні каскади зазвичай завершуються активацією факторів транскрипції, які переміщуються в ядро і вмикають або вимикають певні гени."
    },
    {
        q: "156.) The term 'Mandatory Crossover' states that:",
        options: [
            "a) a double strand break is obligatory for the formation of a crossover",
            "b) Crossover obligatory for the emergence of chromosomal mutations are",
            "c) each chromosome pair makes at least one crossover regardless of its size",
            "d) a crossover between two genes is obligatory for their recombination"
        ],
        correct: [2],
        explanation: "Правило 'обов'язкового кросинговеру' (Mandatory Crossover) стверджує, що для правильного розходження хромосом у мейозі кожна пара гомологічних хромосом (бівалент) повинна утворити щонайменше один кросинговер (хіазму), незалежно від розміру хромосоми."
    },
    {
        q: "157.) The following factors are involved in the development of chromothripsis:",
        options: [
            "a) Sister chromatid exchange",
            "b) Maldistribution of chromatids and meiosis",
            "c) Formation of a micronucleus",
            "d) Faulty assembly of fragmented chromosomes"
        ],
        correct: [2, 3],
        explanation: "Хромотріпсис — це катастрофічне явище, при якому одна (або кілька) хромосом розпадається на сотні фрагментів. Це часто починається з утворення мікроядра (куди потрапляє від відсталої хромосоми), після чого ДНК фрагментується і помилково зшивається назад (NHEJ)."
    },
    {
        q: "158.) In hypophosphatemia (X chromosomal dominant) are:",
        options: [
            "a) all daughters of a sick woman are sick",
            "b) all sons of a sick woman are sick",
            "c) all daughters of a sick man are sick",
            "d) half the daughters of a sick man are sick"
        ],
        correct: [2],
        explanation: "Гіпофосфатемія успадковується як Х-зчеплена домінантна ознака. Це означає, що хворий батько передасть свою єдину (мутантну) Х-хромосому всім своїм донькам, тому всі вони будуть хворими. Синам він передає Y-хромосому, тому вони будуть здорові."
    },
    {
        q: "159.) Post-transcriptional gene regulation in prokaryotes can occur through:",
        options: [
            "a) Histone modification",
            "b) mRNA capping",
            "c) Riboswitches",
            "d) Attenutation"
        ],
        correct: [2],
        explanation: "Рибосвітчі (Riboswitches) — це елементи на мРНК, які зв'язують метаболіти і регулюють трансляцію (посттранскрипційна регуляція) у прокаріотів. (Гістони та 5'-кеп існують лише в еукаріотів, а атенюація є ко-транскрипційною регуляцією)."
    },
    {
        q: "160.) Polytene chromosomes:",
        options: [
            "a) exists in the salivary glands of drosophila larvae",
            "b) arise due to endomitoses",
            "c) offer the possibility of gene mapping based on the bands",
            "d) are bundles of chromatin fibers",
            "e) are caused by a chromosomal mutation"
        ],
        correct: [0, 1, 2, 3],
        explanation: "Політенні (гігантські) хромосоми знаходяться у слинних залозах личинок дрозофіли. Вони утворюються в результаті ендомітозу (реплікація ДНК без поділу клітини), складаються з багатьох ниток хроматину і завдяки смугастості дозволяють проводити картування генів. Це нормальне явище, а не мутація."
    },
    {
        q: "161.) What is metagenomics:",
        options: [
            "a) Is the application of whole-genome shotgun strategies to sequence whole",
            "b) societies of microbes in environmental samples from water, air, and soil"
        ],
        correct: [0, 1],
        explanation: "Метагеноміка — це застосування методів масового секвенування (shotgun) для аналізу всього генетичного матеріалу мікробних угруповань, виділених безпосередньо зі зразків навколишнього середовища (вода, ґрунт, повітря), без культивування."
    },
    {
        q: "162.) Tick correct statements:",
        options: [
            "a) In aneuploidies the whole set of chromosomes is multiplied",
            "b) Hybrids can become fertile through polyploidization",
            "c) Aneuploidies result from the maldistribution of chromosomes or chromatids of mitosis or meiosis",
            "d) Human trisomy 21 results from inadequate crossover"
        ],
        correct: [1, 2, 3],
        explanation: "Анеуплоїдія — це зміна кількості окремих хромосом (через неправильне розходження), а не всього набору (це поліплоїдія). Гібриди дійсно можуть стати фертильними через поліплоїдизацію (алополіплоїдія). Відсутність або нестача кросинговеру підвищує ризик трисомії 21."
    },
    {
        q: "163.) Among the goals of synthetic biology:",
        options: [
            "a) the production of artificial chromosomes",
            "b) the cultivation of tissues"
        ],
        correct: [0],
        explanation: "Однією з головних цілей синтетичної біології є створення штучних хромосом і цілих синтетичних геномів для конструювання нових форм життя з нуля. (Культивування тканин належить до тканинної інженерії)."
    },
    {
        q: "164.) Gene mapping. Tick correct statements:",
        options: [
            "a) in the case of independent segregations of two genes, the frequency of parental and recombinant phenotypes is the same",
            "b) the maximum exchange frequency between 2 genes on a chromosome",
            "c) the minimum exchange frequency of 2 genes on different chromosomes"
        ],
        correct: [0],
        explanation: "При незалежному успадкуванні (гени на різних хромосомах або дуже далеко один від одного) частота рекомбінантних і батьківських фенотипів є однаковою (по 50%)."
    },
    {
        q: "165.) Tick correct statements:",
        options: [
            "a) RNA synthesis requires a DNA primer",
            "b) DNA synthesis occurs in the 5'-3' direction",
            "c) Transcription is the process of transferring information from DNA to RNA",
            "d) Okazaki fragments are formed during discontinuous DNA synthesis"
        ],
        correct: [1, 2, 3],
        explanation: "Синтез ДНК завжди йде у напрямку 5'→3'. Транскрипція — це перенесення інформації від ДНК до РНК. Фрагменти Окадзакі утворюються на відстаючому ланцюзі під час реплікації. (РНК-полімераза НЕ потребує праймера, на відміну від ДНК-полімерази)."
    },
    {
        q: "166.) Bacteria possess:",
        options: [
            "a) Cosmide",
            "b) Mitochondria",
            "c) Cell walls",
            "d) Ribosomes"
        ],
        correct: [2, 3],
        explanation: "Бактерії мають клітинну стінку (з пептидоглікану) та рибосоми (70S). Вони є прокаріотами, тому не мають мембранних органел, таких як мітохондрії. (Косміди — це штучні вектори, створені людиною)."
    },
    {
        q: "167.) Causes of microevolution:",
        options: [
            "a) Genetic drift",
            "b) Natural selection",
            "c) Mutations",
            "d) Reproductive isolation"
        ],
        correct: [0, 1, 2],
        explanation: "Мікроеволюція (зміна частот алелів у популяції) викликається мутаціями, природним добором, генетичним дрейфом та потоком генів. (Репродуктивна ізоляція — це фактор макроеволюції, що веде до видоутворення)."
    },
    {
        q: "168.) A human individual genome:",
        options: [
            "a) differs from the pangenome by approx. 4-5 million nucleotide polymorphisms",
            "b) is a mosaic of sequences from 13 anonymous subjects",
            "c) does not contain recessive lethal alleles",
            "d) differs from the reference genome at > 4 million sites"
        ],
        correct: [0, 3],
        explanation: "Геном окремої людини відрізняється від референсного (еталонного) геному та пангеному приблизно на 4-5 мільйонів однонуклеотидних поліморфізмів (SNP). Кожна людина також носить приховані рецесивні летальні алелі."
    },
    {
        q: "169.) Tick correct statements:",
        options: [
            "a) in a genome library, the DNA fragments are sorted by size",
            "b) In Southern blotting, electrophoretically separated DNA is transferred from the gel to a membrane",
            "c) Library Screening identifies colonies in a library that have a desired insert.",
            "d) Satellite DNA differs by its different density during centrifugation"
        ],
        correct: [1, 2, 3],
        explanation: "Саузерн-блот — це перенесення ДНК з гелю на мембрану. Скринінг бібліотеки дозволяє знайти потрібний ген. Сателітна ДНК має інший вміст GC, тому її щільність відрізняється при центрифугуванні. (У геномній бібліотеці фрагменти не відсортовані, вони випадкові)."
    },
    {
        q: "170.) Tick correct statements:",
        options: [
            "a) Fusion proteins are needed in vector building to ligate DNA sequences",
            "b) In gene tagging, the tag sequence is introduced directly after the stop codon of the target gene",
            "c) GFP tagging can be used to investigate the localization of proteins",
            "d) Fluorescence is the property of molecules to emit longer wavelength light when excited with energetic light"
        ],
        correct: [2, 3],
        explanation: "Флуоресценція — це випромінювання світла більшої довжини хвилі після збудження. Мітка GFP використовується для відстеження локалізації білків у клітині. (Для зшивання ДНК використовується лігаза, а не злиті білки. Мітка має вводитися ДО стоп-кодону, щоб вона транслювалася разом з білком)."
    },
    {
        q: "171.) In the metaphase of mitosis:",
        options: [
            "a) the chromatids migrate to the poles of the cell",
            "b) the chromosomes lie in the equatorial plane",
            "c) the core membrane dissolves",
            "d) the chromosomes are maximally shortened"
        ],
        correct: [1, 3],
        explanation: "В метафазі мітозу хромосоми досягають максимальної конденсації (вкорочення) і шикуються по центру клітини, утворюючи екваторіальну (метафазну) пластинку. Розходження хроматид до полюсів — це анафаза, а розчинення ядерної оболонки — профаза/прометафаза."
    },
    {
        q: "172.) Tick correct statements:",
        options: [
            "a) microarrays can be used to compare gene expression in normal and tumor cells",
            "b) there are contagious tumor diseases",
            "c) the translocation t(8;14) in Burkett lymphoma causes inactivation of c MYC",
            "d) chromosomal aberrations accumulate in tumors"
        ],
        correct: [0, 1, 3],
        explanation: "Мікрочипи дозволяють порівнювати активність генів. Існують заразні пухлини (наприклад, у тасманійських дияволів або собак). У пухлинах дійсно накопичуються хромосомні аберації. (Транслокація при лімфомі Беркітта не інактивує, а навпаки НАДАКТИВУЄ онкоген c-MYC)."
    },
    {
        q: "173.) Tick correct statements:",
        options: [
            "a) DSBs arise as a result of the crossover of homologous chromosomes (chaosms)",
            "b) The DSB-inducing protein Spo11 binds to DNA by forming hydrogen bonds",
            "c) All meiotic DSBs become crossovers",
            "d) Meiotic crossing over starts with programmed DNA double strand breaks (DSBs)."
        ],
        correct: [3],
        explanation: "Мейотичний кросинговер завжди починається із запрограмованих дволанцюгових розривів ДНК (DSBs), які створює фермент Spo11. Не всі розриви стають кросинговерами (деякі репаруються без обміну). Spo11 утворює ковалентні, а не водневі зв'язки."
    },
    {
        q: "174.) Nitrogen base + pentose is called:",
        options: [
            "a) Pyrimidine",
            "b) Nucleotide",
            "c) Nucleoside",
            "d) Purine"
        ],
        correct: [2],
        explanation: "Молекула, що складається лише з азотистої основи та цукру (пентози), називається НУКЛЕОЗИДОМ. Якщо до них додати ще й фосфатну групу, це стане НУКЛЕОТИДОМ."
    },
    {
        q: "175.) The Chargaff rules state that:",
        options: [
            "a) The AT:GC ratio in the two single strands of a double stranded DNA is approximately the same",
            "b) the GC:AT ratio IS always 1:1",
            "c) The ratio of uracil to thyme in the RNA approx. 1:1 is",
            "d) a double-stranded DNA contains the same number of A and T bases"
        ],
        correct: [0, 3],
        explanation: "Правила Чаргаффа стверджують, що в дволанцюговій ДНК кількість аденіну (А) завжди дорівнює кількості тиміну (Т), а гуаніну (Г) — цитозину (Ц). Отже, співвідношення А/Т дорівнює 1. (Співвідношення GC:AT варіюється у різних видів)."
    },
    {
        q: "176.) Dihybrid cross Yellow/round (GGRR) and green/runt (ggrr). What proportion of F2 is phenotypically yellow/runt:",
        options: [
            "a) 9/16",
            "b) 1/16",
            "c) 3/4",
            "d) 3/16"
        ],
        correct: [3],
        explanation: "Жовтий колір і кругла форма є домінантними ознаками. У поколінні F2 дигібридного схрещування фенотипи розподіляються як 9 (обидві домінантні) : 3 (перша домінантна, друга рецесивна) : 3 (перша рецесивна, друга домінантна) : 1 (обидві рецесивні). Жовті/зморшкуваті (yellow/runt) складають 3/16."
    },
    {
        q: "177.) Tick correct statements:",
        options: [
            "a) CDKs are proteins that degrade cyclins at the end of mitosis",
            "b) CDKs form complexes cyclins",
            "c) CDKs are cyclin-dependent kinases",
            "d) Cyclic changes in the concentration of CDKs control the cell cycle"
        ],
        correct: [1, 2],
        explanation: "CDK (циклін-залежні кінази) — це ферменти, які утворюють комплекси з циклінами для просування клітинного циклу. Рівень самих CDK залишається стабільним, циклічно змінюється лише концентрація ЦИКЛІНІВ (тому варіант D хибний)."
    },
    {
        q: "178.) Gene mutations can be triggered by:",
        options: [
            "a) Spontaneous tautomerization of bases",
            "b) The deletion of chromosoneme pieces",
            "c) Reactive oxygen compounds",
            "d) Errors in the replication (slippage) of nucleotide repeats"
        ],
        correct: [0, 2, 3],
        explanation: "Генні мутації можуть бути викликані спонтанною таутомеризацією основ, активними формами кисню та помилками реплікації. (Делеція ділянок хромосом — це хромосомна мутація, а не генна)."
    },
    {
        q: "179.) Children of older fathers inherit more point mutations than children of younger fathers because:",
        options: [
            "a) The sperm originates from spermatogonia, which have already undergone many replication cycles",
            "b) In older men the cohesin is weakened",
            "c) Because over time the meiotic spindle apparatus becomes more prone to error"
        ],
        correct: [0],
        explanation: "З віком сперматогонії чоловіка проходять сотні циклів поділу (реплікації ДНК). З кожним циклом зростає ймовірність помилок ДНК-полімерази, тому старші батьки передають більше точкових мутацій."
    },
    {
        q: "180.) Tick correct statements:",
        options: [
            "a) Point mutations arise from mutagenic agents and replication errors",
            "b) Somatic mutations are hereditary",
            "c) Base substitutions lead to microscopically visible changes in chromosome structure",
            "d) a mutation does not have to lead to a visible change in the phenotype"
        ],
        correct: [0, 3],
        explanation: "Точкові мутації виникають через помилки реплікації або мутагени. Багато мутацій є мовчазними (не змінюють фенотип). Соматичні мутації не спадкуються, а точкові мутації не видно під мікроскопом."
    },
    {
        q: "181.) RNA interference (RNAi):",
        options: [
            "a) is used in molecular biology to inactivate genes"
        ],
        correct: [0],
        explanation: "РНК-інтерференція (RNAi) — це біологічний процес, у якому молекули РНК пригнічують експресію генів або трансляцію (нокдаун генів). Він широко використовується в лабораторіях для цілеспрямованого вимкнення генів."
    },
    {
        q: "182.) By what could an alleged human-chimpanzee hybrid be classified as a chimpanzee around 1970:",
        options: [
            "a) he had 47 chromosomes",
            "b) he had 48 chromosomes",
            "c) he had 46 chromosomes",
            "d) he was diploid"
        ],
        correct: [1],
        explanation: "Людина має 46 хромосом, а шимпанзе — 48. Якби істота була справжнім гібридом, вона мала б 47 хромосом. Знаменитого шимпанзе Олівера підозрювали в тому, що він гібрид, але дослідження показали наявність рівно 48 хромосом, що довело його належність до шимпанзе."
    },
    {
        q: "183.) Gene regulation. The lac operon of E.coli:",
        options: [
            "a) has a binding site for galactose",
            "b) is transcribed in one piece",
            "c) contains the gene for B-galactosidase",
            "d) contains the gene for lysozyme"
        ],
        correct: [1, 2],
        explanation: "Lac-оперон кишкової палички містить гени для метаболізму лактози (включаючи ген β-галактозидази — lacZ). Всі ці гени транскрибуються разом як одна довга (поліцистронна) молекула мРНК."
    },
    {
        q: "184.) Characteristic sequence motifs for Gene Prediction are:",
        options: [
            "a) ApT-Islands",
            "b) TATA Box",
            "c) Zinc finger motif",
            "d) Kozak sequence"
        ],
        correct: [1, 3],
        explanation: "Для комп'ютерного пошуку генів у геномі шукають специфічні послідовності (мотиви). Наприклад, TATA-бокс (вказує на наявність промотора) та послідовність Козак (вказує на старт трансляції). Zinc finger — це структура білка, а не ДНК."
    },
    {
        q: "185.) Which genetic defect is present in achondroplasia:",
        options: [
            "a) autosomal dominant inheritance",
            "b) there are no healthy carriers",
            "c) Mutation in the fibroblast growth factor receptor gene FGR3",
            "d) Accumulation due to new mutation"
        ],
        correct: [0, 2],
        explanation: "Ахондроплазія успадковується за аутосомно-домінантним типом і викликається мутацією в гені FGFR3. Наявність хоча б одного мутантного алеля викликає хворобу, тому здорових носіїв не існує."
    },
    {
        q: "186.) What is the mode of inheritance? Diagram:",
        options: [
            "a) Dominant autosomal inheritance",
            "b) Dominant X-Chromosomal Inheritance.",
            "c) Recessive X-Chromosomal Inheritance",
            "d) Recessive autosomal inheritance"
        ],
        correct: [0],
        explanation: "⚠️ Примітка: У наданому текстовому документі відсутня діаграма (родовід), тому точно визначити тип успадкування для цього запитання неможливо."
    },
    {
        q: "187.) Tick correct statements:",
        options: [
            "a) Corn plants have more DNA/cell than humans",
            "b) Mice have more DNA/cell than yeast",
            "c) Eukaryotes have greater gene density than prokaryotes",
            "d) Man has more genes than a corn plant"
        ],
        correct: [0, 1],
        explanation: "Рослини (як-от кукурудза) часто мають величезні геноми, більші за людський. Миші мають набагато більший геном, ніж дріжджі. (Еукаріоти мають низьку щільність генів через інтрони та сміттєву ДНК, а кукурудза має більше генів, ніж людина)."
    },
    {
        q: "188.) Experiment with DNA replication. Tick the correct statements:",
        options: [
            "a) After the 1st round of replication, all DNA strands were labeled with H3",
            "b) After 2nd round of replication, light and heavy DNA fragments are present in equal amounts.",
            "c) After 2nd round of replication, all DNA were moderately"
        ],
        correct: [0],
        explanation: "В експериментах Тейлора-Вудса-Хьюза з тритієм (H3) після першого раунду реплікації обидві хроматиди кожної хромосоми були мічені. (Зауважте: в експерименті Мезельсона-Сталя 2-й раунд дає 50% легких і 50% ГІБРИДНИХ/середніх, а не важких ДНК)."
    },
    {
        q: "189.) Cell Staining. Tick the correct statements:",
        options: [
            "a) Stained chromosomes can be used to visualize the crossovers",
            "b) In between 2 replication phases, with Brdu stained chromosomes, the sister chromatids are distinguished",
            "c) Something with cell staining methods",
            "d) Something with cell staining methods"
        ],
        correct: [0, 1],
        explanation: "Спеціальні методи фарбування (наприклад, включення BrdU — бромдезоксиуридину) дозволяють відрізнити сестринські хроматиди одна від одної («арлекінські хромосоми») та візуалізувати сестринські хроматидні обміни або кросинговер."
    },
    {
        q: "190.) Paired Genes. Tick the correct statements:",
        options: [
            "a) 2 genes are linked if there are significantly more than 50% of the offspring have the parental type.",
            "b) 2 genes are linked if they are located on different chromosomes.",
            "c) Crossing over destroys gene linkage"
        ],
        correct: [0, 2],
        explanation: "Два гени вважаються зчепленими, якщо вони знаходяться близько на одній хромосомі, через що батьківські фенотипи з'являються у нащадків частіше, ніж у 50% випадків. Кросинговер може розірвати це зчеплення, створивши рекомбінантні типи."
    },
    {
        q: "191.) Mitosis. Tick the correct statements:",
        options: [
            "a) By mitosis the different organs, tissues develop from 1 zygote",
            "b) Mitosis results in 2 daughter cells with the same number of chromosomes, which have half the amount of DNA of the mother cell",
            "c) In some tissues, mitosis serves for cell healing/regeneration"
        ],
        correct: [0, 2],
        explanation: "Мітоз забезпечує ріст організму від однієї зиготи, а також регенерацію та загоєння тканин. Варіант В у цьому контексті часто вважається неточним/хибним, оскільки хоча кількість ДНК зменшується вдвічі порівняно з фазою G2, вона стає такою ж, як у нормальній фазі G1 материнської клітини."
    }
];

let currentTestQueue = [];
let currentQIndex = 0;
let score = { correct: 0, wrong: 0 };

// Navigation Helper Güncellemesi (app.js içindeki mevcut showView fonksiyonuna şu satırı ekle)
// else if (viewName === 'test') { testView.style.display = 'block'; }

// BUNU app.js'DEKİ ESKİ startTestBtn TIKLANMA GÖREVİYLE DEĞİŞTİR
document.getElementById('startTestBtn').addEventListener('click', () => {
    let startIdx = parseInt(document.getElementById('testStartQ').value);
    let endIdx = parseInt(document.getElementById('testEndQ').value);

    // Güvenlik kontrolleri (Eğer boş bırakılırsa veya saçma bir sayı girilirse sistemi çökertmemek için)
    if (isNaN(startIdx) || startIdx < 1) startIdx = 1;
    if (isNaN(endIdx) || endIdx < startIdx) endIdx = startIdx;
    if (endIdx > geneticsQuestions.length) endIdx = geneticsQuestions.length;
    if (startIdx > geneticsQuestions.length) startIdx = geneticsQuestions.length;

    // Soruları RASTGELE DEĞİL, kullanıcının seçtiği aralıkta SIRASIYLA al
    // (Bilgisayar saymaya 0'dan başladığı için startIdx'ten 1 çıkarıyoruz)
    currentTestQueue = geneticsQuestions.slice(startIdx - 1, endIdx);
    
    currentQIndex = 0;
    score = { correct: 0, wrong: 0 };
    updateScoreBoard();
    
    testSetupArea.style.display = 'none';
    testActiveArea.style.display = 'block';
    
    renderQuestion();
});

function renderQuestion() {
    feedbackBox.style.display = 'none';
    submitAnswerBtn.style.display = 'block';
    nextQuestionBtn.style.display = 'none';
    
    questionCounterText.innerText = `Question ${currentQIndex + 1} / ${currentTestQueue.length}`;
    
    const qData = currentTestQueue[currentQIndex];
    questionTitle.innerText = qData.q;
    
    optionsContainer.innerHTML = '';
    qData.options.forEach((optText, index) => {
        const label = document.createElement('label');
        label.className = 'test-option-label';
        label.innerHTML = `<input type="checkbox" name="qOption" value="${index}"> <span>${optText}</span>`;
        optionsContainer.appendChild(label);
    });
}

// BUNU app.js'DEKİ ESKİ submitAnswerBtn TIKLANMA GÖREVİYLE DEĞİŞTİR
submitAnswerBtn.addEventListener('click', () => {
    const selectedCheckboxes = document.querySelectorAll('input[name="qOption"]:checked');
    if (selectedCheckboxes.length === 0) return alert("Please answer the question first!");

    const selectedValues = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
    const qData = currentTestQueue[currentQIndex];
    
    // Doğru cevap kontrolü (dizilerin içeriğini karşılaştırıyoruz)
    const isCorrect = JSON.stringify(selectedValues.sort()) === JSON.stringify(qData.correct.sort());
    
    feedbackBox.style.display = 'block';
    if (isCorrect) {
        score.correct++;
        feedbackBox.className = 'feedback-correct';
        feedbackBox.innerHTML = `✅ Correct! <br><br>📝 <strong>Пояснення:</strong> ${qData.explanation}`;
    } else {
        score.wrong++;
        feedbackBox.className = 'feedback-wrong';
        
        // YENİ EKLENEN KISIM: Doğru şıkların metinlerini bulup alt alta yazdırıyoruz
        const correctAnswersList = qData.correct.map(idx => `✔️ ${qData.options[idx]}`).join('<br>');
        
        feedbackBox.innerHTML = `❌ Wrong. <br><br>🎯 <strong>Правильна відповідь:</strong><br>${correctAnswersList}<br><br>📝 <strong>Пояснення:</strong> ${qData.explanation}`;
    }
    
    updateScoreBoard();
    submitAnswerBtn.style.display = 'none';
    
    if (currentQIndex < currentTestQueue.length - 1) {
        nextQuestionBtn.style.display = 'block';
        nextQuestionBtn.innerText = "Next Question ➡️";
    } else {
        nextQuestionBtn.style.display = 'block';
        nextQuestionBtn.innerText = "🏁 Finish Test";
    }
});

nextQuestionBtn.addEventListener('click', () => {
    if (currentQIndex < currentTestQueue.length - 1) {
        currentQIndex++;
        renderQuestion();
    } else {
        alert(`Test Completed! 🎉\nCorrect: ${score.correct}\nWrong: ${score.wrong}`);
        resetTest();
    }
});

document.getElementById('resetTestBtn').addEventListener('click', resetTest);

function resetTest() {
    testActiveArea.style.display = 'none';
    testSetupArea.style.display = 'flex';
}

function updateScoreBoard() {
    correctScoreEl.innerText = score.correct;
    wrongScoreEl.innerText = score.wrong;
}

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

const authContainer = document.getElementById('authContainer'), appContainer = document.getElementById('appContainer'), welcomeText = document.getElementById('welcomeText');
const homeView = document.getElementById('homeView'), dataView = document.getElementById('dataView'), graphView = document.getElementById('graphView'), percentView = document.getElementById('percentView');
const categoryInput = document.getElementById('categoryInput'), subCategoryInput = document.getElementById('subCategoryInput'), tableBody = document.getElementById('tableBody');
const graphCatSelect = document.getElementById('graphCatSelect'), graphSubSelect = document.getElementById('graphSubSelect');
const percentCatSelect = document.getElementById('percentCatSelect'), percentSubSelect = document.getElementById('percentSubSelect');

let currentUser = null, myChartInstance = null, percentChartInstance = null, isLoginMode = true, tumVeriler = []; 

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
    [homeView, dataView, graphView, percentView].forEach(v => v.style.display = 'none');
    document.getElementById('homeBtn').style.display = 'block';
    if (viewName === 'home') { homeView.style.display = 'flex'; document.getElementById('homeBtn').style.display = 'none'; }
    else if (viewName === 'data') { dataView.style.display = 'block'; setTodayDate(); renderTable(); }
    else if (viewName === 'graph') { graphView.style.display = 'block'; updateGraph(); }
    else if (viewName === 'percent') { percentView.style.display = 'block'; updatePercentGraph(); }
}
document.getElementById('navToDataBtn').addEventListener('click', () => showView('data'));
document.getElementById('navToGraphBtn').addEventListener('click', () => showView('graph'));
document.getElementById('navToPercentBtn').addEventListener('click', () => showView('percent'));
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
        showView('home'); fetchDataFromFirebase(); 
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

// ADD DATA
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

                // DEĞİŞİKLİK BURADA: Hesaplanan yüzde artık yeşil değil, standart siyah kalın fontta (<strong>)
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

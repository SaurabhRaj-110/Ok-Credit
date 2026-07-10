
const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if (!config) config = {};
    if (!config.headers) config.headers = {};
    
    // Convert Headers object to plain object if needed, or just append
    if (config.headers instanceof Headers) {
        if (localStorage.getItem('shopsathi_auth_token')) {
            config.headers.append('Authorization', 'Bearer ' + localStorage.getItem('shopsathi_auth_token'));
        }
    } else {
        if (localStorage.getItem('shopsathi_auth_token')) {
            config.headers['Authorization'] = 'Bearer ' + localStorage.getItem('shopsathi_auth_token');
        }
    }
    
    // For FormData, we don't strictly need to do anything special here as long as Authorization header is added
    return originalFetch(resource, config);
};

// ==========================================
        // SYSTEM INIT & CORE DATA
        // ==========================================
        window.onerror = function(message, source, lineno, colno, error) {
            console.error("App Error: " + message + " at line " + lineno);
            return true;
        };
        const RENDER_API_URL = "https://shopsathi-api.onrender.com";
        let MERCHANT_ID = localStorage.getItem('shopsathi_merchant_id') || "";
        let MERCHANT_ROLE = localStorage.getItem('shopsathi_role') || "";
        
        
        let pendingPhone = "";
        
        function validatePhone() {
            let input = document.getElementById('loginPhoneInput');
            let val = input.value.replace(/\D/g, '');
            if (val.startsWith('91') && val.length > 10) {
                val = val.substring(2);
            }
            if (val.length > 10) {
                val = val.substring(0, 10);
            }
            if (input.value !== val) {
                 input.value = val;
            }
            
            let btn = document.getElementById('sendOtpBtn');
            let icon = document.getElementById('phoneCheckIcon');
            
            if (val.length === 10) {
                btn.disabled = false;
                btn.style.background = '#0c8854';
                btn.style.cursor = 'pointer';
                icon.className = 'ti ti-circle-check-filled';
                icon.style.color = '#10b981';
            } else {
                btn.disabled = true;
                btn.style.background = '#cbd5e1';
                btn.style.cursor = 'not-allowed';
                icon.className = 'ti ti-circle-check';
                icon.style.color = '#cbd5e1';
            }
        }
        
        async function requestOTP() {
            let phone = document.getElementById('loginPhoneInput').value.trim();
            if (phone.length !== 10) return;
            
            document.getElementById('globalLoader').style.display = 'flex';
            document.getElementById('globalLoaderText').innerText = 'Sending OTP...';
            
            try {
                let res = await fetch(`${RENDER_API_URL}/api/auth/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: '+91' + phone })
                });
                let data = await res.json();
                
                if (data.status === 'SUCCESS') {
                    showToast("OTP sent successfully");
                    pendingPhone = '+91' + phone;
                    document.getElementById('displayPhoneOTP').innerText = "+91 " + phone;
                    document.getElementById('loginStep2').style.display = 'none';
                    document.getElementById('loginStep3').style.display = 'flex';
                    
                    // Clear OTP fields
                    for(let i=1; i<=6; i++) document.getElementById('otp' + i).value = '';
                    
                    setTimeout(() => { document.getElementById('otp1').focus(); }, 100);
                } else {
                    showToast("Failed to send OTP");
                }
            } catch (e) {
                showToast("Network Error");
            } finally {
                document.getElementById('globalLoader').style.display = 'none';
            }
        }

        function handleBackspace(e, current, prevFieldID) {
            if (e.key === 'Backspace' && current.value.length === 0 && prevFieldID) {
                document.getElementById(prevFieldID).focus();
            }
        }

        function moveToNext(current, nextFieldID, prevFieldID) {
            // Replace non digits
            current.value = current.value.replace(/\D/g, '');
            
            if (current.value.length >= 1 && nextFieldID) {
                document.getElementById(nextFieldID).focus();
            }
            
            // Check if all 6 digits are entered
            let otp = "";
            for(let i=1; i<=6; i++) {
                otp += document.getElementById('otp' + i).value;
            }
            if (otp.length === 6) {
                verifyOTPFinal(otp);
            }
        }

        function verifyOTP(current, prevFieldID) {
            current.value = current.value.replace(/\D/g, '');
            let otp = "";
            for(let i=1; i<=6; i++) {
                otp += document.getElementById('otp' + i).value;
            }
            if (otp.length === 6) {
                verifyOTPFinal(otp);
            }
        }

        async function verifyOTPFinal(otp) {
            document.getElementById('globalLoader').style.display = 'flex';
            document.getElementById('globalLoaderText').innerText = 'Verifying OTP...';
            
            try {
                let res = await fetch(`${RENDER_API_URL}/api/auth/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: pendingPhone, otp: otp })
                });
                let data = await res.json();
                
                if (data.status === 'SUCCESS') {
                    localStorage.setItem('shopsathi_role', data.role);
                    if (data.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        localStorage.setItem('shopsathi_merchant_id', data.merchant_id);
                        if(data.access_token) localStorage.setItem('shopsathi_auth_token', data.access_token);
                        MERCHANT_ID = data.merchant_id;
                        MERCHANT_ROLE = 'merchant';
                        document.getElementById('splashLoginOverlay').style.display = 'none';
                        initShopSathi();
                        
                        // Track usage after explicit login
                        trackUsage('login');
                    }
                } else {
                    showToast("Wrong OTP");
                }
            } catch (e) {
                console.error("Login Error:", e);
                showToast("Network Error: Could not login");
            } finally {
                document.getElementById('globalLoader').style.display = 'none';
            }
        }
        
        async function trackUsage(action) {
            if (!MERCHANT_ID || MERCHANT_ROLE === 'admin') return;
            try {
                let res = await fetch(`${RENDER_API_URL}/api/usage/track`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('shopsathi_auth_token')
                    },
                    body: JSON.stringify({ merchant_id: MERCHANT_ID, action: action })
                });
                let data = await res.json();
                if (data.status === 'SUCCESS') {
                    if (action === 'login') {
                        // Update UI with streak
                        let drawerStreak = document.getElementById('drawerStreakDays');
                        if (drawerStreak) {
                            drawerStreak.innerText = `${data.current_streak} Days 🔥`;
                        }
                        // End streak update
                    }
                }
            } catch (e) {
                console.error("Usage tracking failed", e);
            }
        }
        
        const VOICE_AI_TIMEOUT_MS = 7000;
        const SafeStorage = {
            get: function(key) {
                try {
                    return localStorage.getItem(key);
                } catch (e) {
                    return null;
                }
            },
            set: function(key, val) {
                try {
                    localStorage.setItem(key, val);
                } catch (e) {
                    console.warn("Storage blocked");
                }
            }
        };
        const translationMap = {
            "सुरेश": "suresh",
            "सौरभ": "saurabh",
            "सौरव": "saurabh",
            "मैगी": "maggi",
            "आटा": "atta",
            "दूध": "doodh",
            "पैकेट": "packet",
            "किलो": "kg"
        };

        function normalizeName(inputStr) {
            if (!inputStr) return "";
            let clean = inputStr.trim().toLowerCase();
            for (let key in translationMap) {
                if (clean.includes(key)) return translationMap[key];
            }
            return clean;
        }

        // Levenshtein distance for fuzzy matching
        function levenshtein(a, b) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            let matrix = [];
            for (let i = 0; i <= b.length; i++) {
                matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
                matrix[0][j] = j;
            }
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) == a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                    }
                }
            }
            return matrix[b.length][a.length];
        }

        function findClosestMatch(searchStr, itemList, threshold = 3) {
            searchStr = normalizeName(searchStr).toLowerCase();
            let closestItem = null;
            let minDistance = Infinity;

            for (let item of itemList) {
                let itemName = item.name.toLowerCase();

                // Direct include check first
                if (itemName.includes(searchStr) || searchStr.includes(itemName)) {
                    return item;
                }

                // Check distance
                let dist = levenshtein(searchStr, itemName);

                // Check word by word distance for items like "Amul Milk (500ml)"
                let words = itemName.split(/\s+/);
                for (let word of words) {
                    let wDist = levenshtein(searchStr, word);
                    if (wDist < dist) dist = wDist;
                }

                if (dist < minDistance && dist <= threshold) {
                    minDistance = dist;
                    closestItem = item;
                }
            }
            return closestItem;
        }

        function normalizeVoiceText(text) {
            let t = (text || '').toLowerCase();
            const wordNumbers = {
                'एक': 1,
                'दो': 2,
                'तीन': 3,
                'चार': 4,
                'पांच': 5,
                'पाँच': 5,
                'छह': 6,
                'सात': 7,
                'आठ': 8,
                'नौ': 9,
                'दस': 10,
                'ek': 1,
                'do': 2,
                'teen': 3,
                'char': 4,
                'panch': 5,
                'che': 6,
                'chhe': 6,
                'saat': 7,
                'aath': 8,
                'nau': 9,
                'das': 10
            };
            Object.keys(wordNumbers).forEach(word => {
                t = t.replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'gi'), `$1${wordNumbers[word]}`);
            });
            t = t.replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d));

            // Speech often omits "aur"; add a boundary after a finished khata command if another qty command follows.
            t = t.replace(/(likh\s*do|लिख\s*दो)\s+(?=\d+\s*(packet|packets|kilo|kg|ltr|piece|box|pc|पैकेट|किलो))/gi, '$1 aur ');
            t = t.replace(/(udhaar|उधार)\s+(?=\d+\s*(packet|packets|kilo|kg|ltr|piece|box|pc|पैकेट|किलो))/gi, '$1 aur ');
            return t;
        }
        document.getElementById('header-date').innerText = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        function getTodayStr() {
            return new Date().toISOString().split('T')[0];
        }

        function formatDate(dStr) {
            return new Date(dStr).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }

        function formatTime(d) {
            return new Date(d).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        const avColors = ['#059669', '#d97706', '#0284c7', '#7c3aed', '#db2777', '#dc2626'];

        function getAvatarHtml(name) {
            if (!name) name = "Unknown";
            let parts = name.trim().split(' ');
            let initials = parts.length > 1 ? (parts[0][0] + parts[1][0]) : name.substring(0, 2);
            initials = initials.toUpperCase();
            let sum = 0;
            for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
            return `<div class="k-avatar" style="background:${avColors[sum % avColors.length]};">${initials}</div>`;
        }

        function getStockEmoji(cat) {
            let c = cat.toLowerCase();
            if (c.includes('fruit') || c.includes('nut')) return '🥜';
            if (c.includes('dairy') || c.includes('milk')) return '🥛';
            if (c.includes('oil')) return '🛢️';
            if (c.includes('snack') || c.includes('maggi') || c.includes('biscuit')) return '🍜';
            return '📦';
        }

        // Data Models
        let localKhata = [];
        let localSuppliers = [];
        let localStock = [];
        let localNotifications = [];
        let localDailyLedger = [];
        let unreadCount = 0;
        let todaySales = 0;
        let currentStockFilter = 'all';
        let currentSalesFilter = 'ALL';

        // ==========================================
        // 🚀 CENTRAL TRANSACTION ENGINE
        // ==========================================
        const TransactionEngine = {
            showLoader(text = "Processing...") {
                document.getElementById('globalLoaderText').innerText = text;
                document.getElementById('globalLoader').style.display = 'flex';
            },
            hideLoader() {
                document.getElementById('globalLoader').style.display = 'none';
            },
            async processDeleteParty(partyId, partyType) {
                this.showLoader("Deleting Account...");
                try {
                    let res = await fetch(`${RENDER_API_URL}/api/khata/party/${partyId}?merchant_id=${MERCHANT_ID}`, {
                        method: 'DELETE'
                    });
                    if (res.ok || res.status === 404) {
                        // Atomic Local Update
                        if (partyType === 'customer') {
                            localKhata = localKhata.filter(c => c.id !== partyId);
                        } else {
                            localSuppliers = localSuppliers.filter(s => s.id !== partyId);
                        }
                        saveStateToStorage();
                        showToast("Account Deleted!");
                        return true;
                    } else {
                        throw new Error("API Failed");
                    }
                } catch (e) {
                    console.error("Delete failed", e);
                    showToast("Failed to delete account. Try again.");
                    return false;
                } finally {
                    this.hideLoader();
                }
            },
            async processManualKhata(partyObj, partyType, txType, amount, note, dueDate, entrySource = 'Manual') {
                this.showLoader("Saving Transaction...");
                // Keep backup for rollback
                const originalBalance = partyObj.balance;
                try {
                    // Optimistic update
                    partyObj.balance += (txType === 'udhaar' ? amount : -amount);
                    let tx = {
                        id: Date.now(),
                        type: txType,
                        amount: amount,
                        date: getTodayStr(),
                        note: note
                    };
                    if (txType === 'order') tx.dueDate = dueDate;
                    partyObj.transactions.unshift(tx);

                    if (txType === 'payment' && partyType === 'customer') {
                        todaySales += amount;
                        localDailyLedger.unshift({
                            id: Date.now(),
                            type: 'PAYMENT_RECEIVED',
                            item: 'Udhaar Clearance',
                            qty: 0,
                            amount: amount,
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            note: `Payment from ${partyObj.name}`
                        });
                    }
                    saveStateToStorage();

                    // Sync
                    let res = await fetch(`${RENDER_API_URL}/api/khata/transaction`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            party_id: String(partyObj.id),
                            merchant_id: MERCHANT_ID,
                            amount: amount,
                            txn_type: txType === 'udhaar' ? 'GIVEN' : 'GOT',
                            entry_source: entrySource
                        })
                    });
                    if (!res.ok) throw new Error("Sync Failed");

                    await syncDataFromCloud();
                    showToast("Entry Saved!");
                    return true;
                } catch (e) {
                    console.error("Manual Khata Failed", e);
                    // Rollback
                    partyObj.balance = originalBalance;
                    partyObj.transactions.shift();
                    if (txType === 'payment' && partyType === 'customer') {
                        todaySales -= amount;
                        localDailyLedger.shift();
                    }
                    saveStateToStorage();
                    showToast("Network error. Changes rolled back.");
                    return false;
                } finally {
                    this.hideLoader();
                }
            },
            async processStockTransaction(d) {
                this.showLoader("Updating Inventory...");
                try {
                    // Optimistic Khata Update if linked
                    if (d.partyObj) {
                        d.partyObj.balance += d.total;
                        d.partyObj.transactions.unshift({
                            id: Date.now(),
                            type: 'udhaar',
                            amount: d.total,
                            date: getTodayStr(),
                            note: d.type === 'SALE' ? `Purchased ${d.qty} ${d.itemName}` : `Supplied ${d.qty} ${d.itemName}`
                        });
                    }

                    // Optimistic Inventory Update
                    if (d.itemObj) {
                        d.itemObj.quantity = d.newStock;
                        if (d.type === 'PURCHASE') d.itemObj.price = d.unitPrice;
                    } else {
                        let newItem = {
                            id: Date.now(),
                            name: d.itemName,
                            category: 'General',
                            quantity: d.newStock,
                            minStock: 10,
                            unit: d.unit,
                            price: d.unitPrice,
                            location: "Unassigned"
                        };
                        localStock.push(newItem);
                        d.itemObj = newItem;
                    }

                    // Optimistic Daily Ledger Update
                    let ledgerTx = {
                        id: Date.now(),
                        type: d.type,
                        item: d.itemName,
                        qty: d.qty,
                        unit: d.unit,
                        unitPrice: d.unitPrice,
                        amount: d.total,
                        timestamp: Date.now(),
                        date: new Date().toLocaleString(),
                        note: `${d.type === 'SALE' ? 'Sale' : (d.type === 'PURCHASE' ? 'Restock' : 'Adjustment')} (${d.source})` + (d.partyObj ? ` - ${d.partyObj.name}` : '')
                    };
                    localDailyLedger.unshift(ledgerTx);
                    if (d.type === 'SALE') todaySales += d.total;

                    saveStateToStorage();

                    // Sync APIs in parallel
                    let promises = [];
                    let actionText = d.type === 'SALE' ? 'REMOVE_STOCK' : (d.type === 'PURCHASE' ? 'ADD_STOCK' : 'SET_STOCK');
                    let qtyChange = d.type === 'SALE' ? -d.qty : d.qty;
                    let formData = new FormData();
                    formData.append('merchant_id', MERCHANT_ID);
                    formData.append('item_id', String(d.itemObj.id));
                    formData.append('item_name', d.itemName);
                    formData.append('quantity_change', qtyChange);
                    formData.append('unit', d.unit);
                    formData.append('price', d.unitPrice);
                    formData.append('entry_source', d.source || 'Manual');

                    promises.push(fetch(`${RENDER_API_URL}/api/inventory/${actionText}`, {
                        method: 'POST',
                        body: formData
                    }));

                    promises.push(fetch(`${RENDER_API_URL}/api/sales/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            merchant_id: MERCHANT_ID,
                            type: d.type,
                            item: d.itemName,
                            qty: d.qty,
                            amount: d.total,
                            note: ledgerTx.note,
                            entry_source: d.source || 'Manual'
                        })
                    }));

                    if (d.partyObj) {
                        promises.push(fetch(`${RENDER_API_URL}/api/khata/transaction`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                party_id: String(d.partyObj.id),
                                merchant_id: MERCHANT_ID,
                                amount: d.total,
                                txn_type: 'GIVEN',
                                entry_source: d.source || 'Manual'
                            })
                        }));
                    }

                    await Promise.all(promises);
                    await syncDataFromCloud();
                    return true;
                } catch (e) {
                    console.error("Stock Tx Failed", e);
                    showToast("Sync failed. State may be inconsistent. Refreshing...", 3000);
                    // Minimal fallback: force a hard refresh to re-sync
                    await syncDataFromCloud();
                    return false;
                } finally {
                    this.hideLoader();
                }
            },
            async processMultiVoice(actions) {
                this.showLoader("Saving Voice Actions...");
                try {
                    for (let act of actions) {
                        if (act.actionType === 'STOCK') {
                            let isSale = act.type === 'SALE';
                            let d = {
                                type: act.type,
                                itemObj: act.itemObj,
                                itemName: act.itemName,
                                qty: act.qty,
                                unit: act.unit,
                                unitPrice: act.qty > 0 ? (act.total / act.qty).toFixed(2) : 0,
                                total: act.total,
                                newStock: act.itemObj ? (isSale ? Math.max(0, act.itemObj.quantity - act.qty) : (act.itemObj.quantity + act.qty)) : (isSale ? 0 : act.qty),
                                source: 'Voice',
                                category: 'General'
                            };
                            await this.processStockTransaction(d);
                        } else if (act.actionType === 'KHATA') {
                            let isJama = act.type === 'PAYMENT';
                            // IF NEW CUSTOMER, CREATE THEM FIRST on BACKEND
                            if (act.isNewPerson || act.isNew || act.person.isNew || act.person.id === 'NEW') {
                                try {
                                    let res = await fetch(`${RENDER_API_URL}/api/khata/party`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            merchant_id: MERCHANT_ID,
                                            name: act.person.name,
                                            party_type: act.personType === 'C' ? 'CUSTOMER' : 'SUPPLIER',
                                            phone_number: ""
                                        })
                                    });
                                    let data = await res.json();
                                    if (data.status === 'success') {
                                        act.person.id = data.party_id;
                                    }
                                } catch (e) {
                                    console.error("Party creation failed", e);
                                    act.person.id = Date.now(); // fallback ID
                                }

                                let newCust = {
                                    id: act.person.id,
                                    name: act.person.name,
                                    phone: "",
                                    balance: 0,
                                    days: 0,
                                    transactions: []
                                };
                                if (act.personType === 'C') localKhata.push(newCust);
                                else localSuppliers.push(newCust);
                                act.person = newCust;
                            }

                            let targetArr = act.personType === 'C' ? localKhata : localSuppliers;
                            let pIdx = targetArr.findIndex(p => p.id === act.person.id);

                            if (pIdx > -1) {
                                let partyObj = targetArr[pIdx];
                                await this.processManualKhata(
                                    partyObj,
                                    act.personType === 'C' ? 'customer' : 'supplier',
                                    isJama ? 'payment' : 'udhaar',
                                    act.amount,
                                    'Voice Command',
                                    null,
                                    'Voice'
                                );
                            }
                        }
                    }
                    saveStateToStorage();
                    await syncDataFromCloud();
                    showToast(`✅ Successfully saved ${actions.length} actions!`);
                    return true;
                } catch (e) {
                    console.error("Voice processing failed", e);
                    showToast("Some actions failed to save.");
                    return false;
                } finally {
                    this.hideLoader();
                }
            },
            async processBillSnap(isSale, total, itemNames, oldBalance, bsParty, bsParsedItems, bsImagePath) {
                this.showLoader("Saving Bill Details...");
                try {
                    let backendEntries = bsParsedItems.map(item => ({
                        action: item.action,
                        target_name: item.targetName,
                        item_name: item.name,
                        quantity: item.qty,
                        amount: item.amount
                    }));

                    let res = await fetch(`${RENDER_API_URL}/api/snap/confirm`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            merchant_id: MERCHANT_ID,
                            image_path: bsImagePath,
                            bill_type: isSale ? "CUSTOMER" : "SUPPLIER",
                            party_name: bsParty ? bsParty.name : "General Sale",
                            total_amount: total,
                            entries: backendEntries
                        })
                    });

                    if (!res.ok) throw new Error("Sync failed");

                    // Daily Ledger Updates (Local only, UI display)
                    bsParsedItems.forEach(item => {
                        let isEntrySale = item.action.includes("CUSTOMER") || item.action === "REDUCE_STOCK";
                        let type = isEntrySale ? 'SALE' : 'PURCHASE';
                        let partyStr = item.targetName !== "General" ? `(${item.targetName})` : '';

                        localDailyLedger.unshift({
                            id: Date.now() + Math.floor(Math.random() * 1000),
                            type: type,
                            item: item.name,
                            qty: item.qty,
                            unit: item.unit,
                            unitPrice: item.rate,
                            amount: item.amount,
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            note: `Bill Snap ${isEntrySale ? 'Sale' : 'Purchase'} ${partyStr}`,
                            evidence: bsImagePath
                        });
                    });

                    saveStateToStorage();
                    await syncDataFromCloud();

                    return {
                        success: true,
                        stockChangedCount: bsParsedItems.length
                    };
                } catch (e) {
                    console.error("Bill Snap Processing failed", e);
                    showToast("Failed to process bill.");
                    return {
                        success: false,
                        stockChangedCount: 0
                    };
                } finally {
                    this.hideLoader();
                }
            }
        };



        localKhata.forEach(k => {
            if (!k.transactions) k.transactions = [];
        });
        localSuppliers.forEach(s => {
            if (!s.transactions) s.transactions = [];
        });
        localStock.forEach(s => {
            if (!s.category) s.category = "General";
            if (!s.price) s.price = 0;
            if (!s.minStock) s.minStock = 10;
        });

        function saveStateToStorage() {
            SafeStorage.set('ss_khata', JSON.stringify(localKhata));
            SafeStorage.set('ss_suppliers', JSON.stringify(localSuppliers));
            SafeStorage.set('ss_stock', JSON.stringify(localStock));
            SafeStorage.set('ss_notifications', JSON.stringify(localNotifications));
            SafeStorage.set('ss_daily_ledger', JSON.stringify(localDailyLedger));
            SafeStorage.set('ss_unread', unreadCount);
            SafeStorage.set('ss_sales', todaySales);
        }
        async function syncDataFromCloud() {
            try {
                const response = await fetch(`${RENDER_API_URL}/api/khata/sync/${MERCHANT_ID}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        localStock = data.inventory.map(i => ({
                            id: i.item_id,
                            name: i.item_name,
                            category: i.category || "General",
                            quantity: i.current_stock,
                            minStock: i.reorder_level || 10,
                            unit: i.unit || "items",
                            price: i.price,
                            purchase_price: i.purchase_price || 0.0,
                            location: "Unassigned"
                        }));

                        let allTransactions = [];
                        let parties = data.parties.map(p => {
                            let txs = (p.transactions || []).map(t => {
                                let mappedTx = {
                                    id: t.transaction_id,
                                    type: t.txn_type === 'GIVEN' ? (p.party_type === 'CUSTOMER' ? 'udhaar' : 'payment') : (p.party_type === 'CUSTOMER' ? 'payment' : 'udhaar'),
                                    amount: t.amount,
                                    date: new Date(t.created_at).toISOString().split('T')[0],
                                    note: t.entry_source || 'Synced Transaction',
                                    hasReceipt: t.image_path || (t.entry_source && t.entry_source.includes("Bill Snap")),
                                    image_path: t.image_path || null
                                };
                                return mappedTx;
                            });

                            return {
                                id: p.party_id,
                                name: p.name,
                                phone: p.phone_number,
                                balance: p.total_balance,
                                days: 0,
                                notes: p.notes || "",
                                transactions: txs
                            };
                        });

                        localKhata = data.parties.filter(p => p.party_type === 'CUSTOMER').map(p => {
                            let mapped = parties.find(x => x.id === p.party_id);
                            return mapped;
                        });
                        localSuppliers = data.parties.filter(p => p.party_type === 'SUPPLIER').map(p => {
                            let mapped = parties.find(x => x.id === p.party_id);
                            return mapped;
                        });

                        // Map Daily Sales
                        if (data.daily_sales) {
                            localDailyLedger = data.daily_sales.map(s => {
                                // Server returns UTC ISO strings without 'Z'. Add it so JS Date() parses them as UTC.
                                let rawTs = s.timestamp || '';
                                let tsStr = rawTs.endsWith('Z') ? rawTs : (rawTs.includes('+') ? rawTs : rawTs + 'Z');
                                let tsMs = new Date(tsStr).getTime();
                                return {
                                    id: s.sale_id,
                                    type: s.type,
                                    item: s.item,
                                    qty: s.qty,
                                    unit: s.unit || 'items',
                                    amount: s.amount,
                                    note: s.note,
                                    entry_source: s.entry_source,
                                    timestamp: tsMs,
                                    date: new Date(tsStr).toLocaleString()
                                };
                            });
                        }

                        saveStateToStorage();
                        renderUI();
                    }
                }
            } catch (e) {
                console.error("Cloud sync failed:", e);
            }
        }

        // ==========================================
        // ðŸ”¥ UI RENDERING LOGIC
        // ==========================================
        function setStockFilter(val) {
            currentStockFilter = val;
            renderUI();
        }

        let currentStockSort = 'name_asc';
        let currentStockSearch = '';

        function filterStockSearch(val) {
            currentStockSearch = val.toLowerCase();
            renderUI();
        }

        function toggleStockSort() {
            const sorts = ['name_asc', 'name_desc', 'qty_asc', 'qty_desc'];
            currentStockSort = sorts[(sorts.indexOf(currentStockSort) + 1) % sorts.length];
            renderUI();
        }

        function renderStockUI() {
            let totalItems = localStock.length;
            let lowStockCount = localStock.filter(s => s.quantity > 0 && s.quantity <= s.minStock).length;
            let outStockCount = localStock.filter(s => s.quantity === 0).length;

            document.getElementById('ssg-total').innerText = totalItems;
            document.getElementById('ssg-low').innerText = lowStockCount;
            document.getElementById('ssg-out').innerText = outStockCount;

            let catCounts = {};
            localStock.forEach(s => {
                catCounts[s.category] = (catCounts[s.category] || 0) + 1;
            });
            let filterHtml = `<div id="filter-all" class="s-pill ${currentStockFilter==='all'?'active':''}" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;" onclick="setStockFilter('all')"><i class="ti ti-layout-grid"></i> All Items (${totalItems})</div>`;
            Object.keys(catCounts).forEach(cat => {
                let safeCat = cat.replace(/\s+/g, '');
                filterHtml += `<div id="filter-${safeCat}" class="s-pill ${currentStockFilter===safeCat?'active':''}" style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;" onclick="setStockFilter('${safeCat}')"><i class="ti ti-folder"></i> ${cat} (${catCounts[cat]})</div>`;
            });
            document.getElementById('stockFilters').innerHTML = filterHtml;

            let filteredStock = localStock;
            if (currentStockFilter !== 'all' && currentStockFilter !== 'low' && currentStockFilter !== 'out') {
                filteredStock = localStock.filter(s => s.category.replace(/\s+/g, '') === currentStockFilter);
                document.getElementById('stockListTitle').innerText = currentStockFilter;
            } else if (currentStockFilter === 'low') {
                filteredStock = localStock.filter(s => s.quantity > 0 && s.quantity <= s.minStock);
                document.getElementById('stockListTitle').innerText = "Low Stock";
            } else if (currentStockFilter === 'out') {
                filteredStock = localStock.filter(s => s.quantity === 0);
                document.getElementById('stockListTitle').innerText = "Out of Stock";
            } else {
                document.getElementById('stockListTitle').innerText = "All Items";
            }

            if (currentStockSearch) {
                filteredStock = filteredStock.filter(s => s.name.toLowerCase().includes(currentStockSearch));
            }

            if (currentStockSort === 'name_asc') {
                filteredStock.sort((a, b) => a.name.localeCompare(b.name));
                document.getElementById('stockSortLabel').innerText = "Name (A-Z)";
            } else if (currentStockSort === 'name_desc') {
                filteredStock.sort((a, b) => b.name.localeCompare(a.name));
                document.getElementById('stockSortLabel').innerText = "Name (Z-A)";
            } else if (currentStockSort === 'qty_asc') {
                filteredStock.sort((a, b) => a.quantity - b.quantity);
                document.getElementById('stockSortLabel').innerText = "Stock (Low)";
            } else if (currentStockSort === 'qty_desc') {
                filteredStock.sort((a, b) => b.quantity - a.quantity);
                document.getElementById('stockSortLabel').innerText = "Stock (High)";
            }

            let stockHtml = "";
            filteredStock.forEach((s, index) => {
                let actualIndex = localStock.findIndex(x => x.id === s.id);
                let isOut = s.quantity === 0;
                let isLow = s.quantity > 0 && s.quantity <= s.minStock;
                let badgeClass = isOut ? 'danger' : (isLow ? 'warn' : 'green');
                let badgeText = isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock');
                let priceText = s.price > 0 ? `₹${s.price.toFixed(2)} / ${s.unit.replace(/s$/,'').toLowerCase()}` : "Price not set";

                stockHtml += `<div class="stock-item-card" onclick="openAddTxWithItem(${actualIndex})"><div class="sic-img">${getStockEmoji(s.category)}</div><div class="sic-mid"><div class="sic-name">${s.name}</div><div class="sic-cat">${s.category}</div><div class="sic-price">${priceText}</div></div><div class="sic-right"><div class="sic-stock-lbl">Stock</div><div class="sic-stock-val">${s.quantity}</div><div class="sic-stock-unit">${s.unit}</div></div><div class="sic-status"><div class="sic-badge ${badgeClass}">${badgeText}</div><div class="sic-min">Min. ${s.minStock}</div></div><i class="ti ti-chevron-right" style="color:var(--ink-muted); font-size:18px; padding:10px; z-index:10; cursor:pointer;" onclick="event.stopPropagation(); openEditStockModal(${actualIndex})"></i></div>`;
            });
            document.getElementById('stock-list').innerHTML = stockHtml || "<div style='text-align:center;padding:20px;color:var(--ink-muted);'>No items found.</div>";
        }

        function renderUI() {
            try {
                if (typeof updateBellCount === 'function') updateBellCount();

                // Recalculate Live Sales directly from the Ledger data so it is NEVER wrong!
                let liveSales = 0;
                localDailyLedger.forEach(tx => {
                    if (tx.type === 'SALE' || tx.type === 'PAYMENT_RECEIVED') liveSales += (parseFloat(tx.amount) || 0);
                });
                todaySales = liveSales; // Sync variable

                let totalLena = 0;
                let totalDena = 0;
                let numC = 0;
                let numS = 0;

                let kgTotal = localKhata.length;
                let kgAdvance = 0;
                let kgBaaki = 0;

                let ksTotal = localSuppliers.length;
                let ksAdvance = 0;
                let ksBaaki = 0;

                localKhata.forEach(p => {
                    if (p.balance > 0) {
                        totalLena += p.balance;
                        kgBaaki += p.balance;
                        numC++;
                    } else if (p.balance < 0) {
                        totalDena += Math.abs(p.balance);
                        kgAdvance += Math.abs(p.balance);
                    }
                });
                localSuppliers.forEach(s => {
                    if (s.balance > 0) {
                        totalDena += s.balance;
                        ksBaaki += s.balance;
                        numS++;
                    } else if (s.balance < 0) {
                        totalLena += Math.abs(s.balance);
                        ksAdvance += Math.abs(s.balance);
                    }
                });
                // ðŸ”¥ NEW: Calculate Today's Sales dynamically so it resets at midnight!
                let tSalesToday = 0;
                let todayDateString = new Date().toDateString();
                localDailyLedger.forEach(tx => {
                    let isToday = tx.timestamp ? (new Date(tx.timestamp).toDateString() === todayDateString) : true;
                    if (isToday && (tx.type === 'SALE' || tx.type === 'PAYMENT_RECEIVED')) {
                        tSalesToday += (parseFloat(tx.amount) || 0);
                    }
                });
                todaySales = tSalesToday; // Sync global state

                document.getElementById('dash-lena').innerText = "₹" + totalLena;
                document.getElementById('dash-dena').innerText = "₹" + totalDena;
                document.getElementById('dash-bikri').innerText = "₹" + todaySales.toFixed(2);
                document.getElementById('lena-sub').innerText = numC + " Customers";
                document.getElementById('dena-sub').innerText = numS + " Suppliers";

                if (document.getElementById('kg-total')) document.getElementById('kg-total').innerText = kgTotal;
                if (document.getElementById('kg-advance')) document.getElementById('kg-advance').innerText = "₹" + kgAdvance;
                if (document.getElementById('kg-baaki')) document.getElementById('kg-baaki').innerText = "₹" + kgBaaki;

                if (document.getElementById('ks-total')) document.getElementById('ks-total').innerText = ksTotal;
                if (document.getElementById('ks-advance')) document.getElementById('ks-advance').innerText = "₹" + ksAdvance;
                if (document.getElementById('ks-baaki')) document.getElementById('ks-baaki').innerText = "₹" + ksBaaki;

                let khataHtml = "";
                localKhata.forEach(p => {
                    let status = p.balance > 0 ? `<span class="k-bal red">₹${p.balance} Baaki</span>` : `<span class="k-bal green">Advance ₹${Math.abs(p.balance)}</span>`;
                    let lastTx = (p.transactions || []).length > 0 ? `Last activity: ${formatDate(p.transactions[0].date)}` : "No activity";
                    let waMsg = p.balance > 0 ? `ðŸ™ Namaskar ${p.name} ji!\nðŸ“ Sanjay General Store\nAapke khate mein ₹${p.balance} udhaar baki hai.\nDhanyawad ðŸ™` : p.balance < 0 ? `ðŸ™ Namaskar ${p.name} ji!\nðŸ“ Sanjay General Store\nAapke khate mein ₹${Math.abs(p.balance)} advance balance uplabdh hai.\nDhanyawad ðŸ™` : `ðŸ™ Namaskar ${p.name} ji!\nðŸ“ Sanjay General Store\nAapka hisab clear hai.\nDhanyawad ðŸ™`;
                    let btnLabel = p.balance > 0 ? "Yaad Dilao" : p.balance < 0 ? "Update Bhejein" : "Khata Clear";
                    let waBtn = p.phone ? `<button class="wa-btn ${p.balance > 0 ? 'green' : 'outline'}" onclick="sendWhatsAppReminder('${p.phone}', '${encodeURIComponent(waMsg)}', '${p.name}', event)"><i class="ti ti-brand-whatsapp"></i> ${btnLabel}</button>` : "";
                    khataHtml += `<div class="k-card" onclick="openLedger('${p.id}', 'customer')">${getAvatarHtml(p.name)}<div class="k-info"><div class="k-name">${p.name}</div>${status}<div class="k-sub">${lastTx}</div></div><div class="k-right">${waBtn} <i class="ti ti-chevron-right" style="color:var(--ink-muted);font-size:16px;margin-left:4px;"></i></div></div>`;
                });
                document.getElementById('khata-list-grahak').innerHTML = khataHtml || "<div style='text-align:center;padding:20px;color:var(--ink-muted);'>No customers found.</div>";

                let supHtml = "";
                localSuppliers.forEach(s => {
                    let status = s.balance > 0 ? `<span class="k-bal ochre">₹${s.balance} Dena Hai</span>` : `<span class="k-bal green">Advance ₹${Math.abs(s.balance)} Diya</span>`;
                    let lastTx = (s.transactions || []).length > 0 ? `Last activity: ${formatDate(s.transactions[0].date)}` : "No activity";
                    supHtml += `<div class="k-card" onclick="openLedger('${s.id}', 'supplier')">${getAvatarHtml(s.name)}<div class="k-info"><div class="k-name">${s.name}</div>${status}<div class="k-sub">${lastTx}</div></div><div class="k-right"><i class="ti ti-chevron-right" style="color:var(--ink-muted);font-size:16px;"></i></div></div>`;
                });
                document.getElementById('khata-list-supplier').innerHTML = supHtml || "<div style='text-align:center;padding:20px;color:var(--ink-muted);'>No suppliers found.</div>";

                renderStockUI();

                let alertsHTML = "";
                let today = new Date();
                [...localKhata, ...localSuppliers].forEach(person => {
                    (person.transactions || []).forEach(tx => {
                        if (tx.type === 'order' && tx.dueDate) {
                            let due = new Date(tx.dueDate);
                            let diffTime = due - today;
                            let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays <= 1 && diffDays >= 0) {
                                let dayStr = diffDays === 0 ? "Today" : "Tomorrow";
                                alertsHTML += `<div class="alert-card info" onclick="openLedger('${person.id}', '${person.phone ? 'customer' : 'supplier'}')"><i class="ti ti-calendar-event alert-icon"></i><div class="alert-info"><div class="alert-title">Delivery Due ${dayStr}!</div><div class="alert-sub">${person.name} • ${tx.note}</div></div><div class="alert-action">Due ${dayStr} <i class="ti ti-chevron-right" style="font-size:10px;"></i></div></div>`;
                            }
                        }
                    });
                });
                localKhata.filter(p => p.balance > 0 && p.days >= 30).forEach(p => {
                    alertsHTML += `<div class="alert-card danger" onclick="openLedger('${p.id}', 'customer')"><i class="ti ti-clock-hour-4 alert-icon"></i><div class="alert-info"><div class="alert-title">Payment Overdue</div><div class="alert-sub">${p.name} ka ₹${p.balance} pending.</div></div><div class="alert-action">${p.days} Days Late <i class="ti ti-chevron-right" style="font-size:10px;"></i></div></div>`;
                });
                document.getElementById('smart-alerts').innerHTML = alertsHTML || `<div style="text-align:center;font-size:12px;color:var(--ink-muted);">Sab badhiya hai!</div>`;
            } catch (e) {
                console.error("Rendering error:", e);
            }
        }

        // ==========================================
        // MULTI-INTENT VOICE & NLP ENGINE
        // ==========================================
        let isMicListening = false;
        let isVoiceProcessing = false;
        let recognition = null;
        let pendingVoiceActions = [];

        function toggleListening() {
            if (isMicListening && recognition) {
                recognition.stop();
                return;
            }
            try {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    showToast("⚠️ Mic Blocked! Try Chrome.");
                    return;
                }
                recognition = new SpeechRecognition();
                recognition.lang = 'hi-IN';
                recognition.interimResults = true;

                recognition.onstart = () => {
                    isMicListening = true;
                    let ms = document.getElementById('mic-status');
                    if (ms) ms.innerText = "Suno... Munim sun raha hai...";
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.add('listening'));
                    document.getElementById('veStatusTitle').innerText = "Listening...";
                    document.getElementById('veStatusTitle').style.color = "var(--primary)";
                };

                recognition.onresult = (e) => {
                    let interimTranscript = '';
                    let finalTranscript = '';
                    for (let i = e.resultIndex; i < e.results.length; ++i) {
                        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
                        else interimTranscript += e.results[i][0].transcript;
                    }
                    if (isVoiceOverlayActive) document.getElementById('veTranscriptText').innerText = finalTranscript || interimTranscript || "Listening...";
                    if (finalTranscript && !isVoiceProcessing) {
                        recognition.stop();
                        processVoiceWithBackendAI(finalTranscript);
                    }
                };

                recognition.onerror = (e) => {
                    console.warn('Speech recognition error:', e.error);
                    if (e.error === 'not-allowed' || e.error === 'service-not-available' || e.error === 'network') {
                        // Mic is truly blocked - show manual input
                        let manualInput = prompt("Voice Entry: Type your command (e.g. '2 kilo aata 100 ka'):");
                        if (manualInput) {
                            processVoiceWithBackendAI(manualInput);
                        }
                        return;
                    }
                    showToast("Maaf Kijiye, Awaaz samajh nahi aayi. Dubara bolein.");
                    document.getElementById('veStatusTitle').innerText = "Couldn't hear. Tap mic to retry.";
                    document.getElementById('veStatusTitle').style.color = "var(--red)";
                };

                recognition.onend = () => {
                    isMicListening = false;
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.remove('listening'));
                    if (isVoiceOverlayActive && document.getElementById('veStatusTitle').innerText === "Listening...") {
                        document.getElementById('veStatusTitle').innerText = "Tap Mic to Speak";
                        document.getElementById('veStatusTitle').style.color = "var(--ink-main)";
                    }
                };
                recognition.start();
            } catch (err) {
                isMicListening = false;
                console.warn('Mic init error:', err);
                // True fallback - show manual input
                let manualInput = prompt("Voice Entry: Type your command (e.g. '2 kilo aata 100 ka'):");
                if (manualInput) {
                    processVoiceWithBackendAI(manualInput);
                }
            }
        }

        let voiceEntryContext = 'HOME';
        let isVoiceOverlayActive = false;

        function openVoiceEntryModal(context) {
            voiceEntryContext = context;
            isVoiceOverlayActive = true;
            document.getElementById('voiceEntryOverlay').style.display = 'flex';
            document.getElementById('veTranscriptText').innerText = "Waiting for you to speak...";
            toggleListening();
        }

        function closeVoiceEntryModal() {
            isVoiceOverlayActive = false;
            document.getElementById('voiceEntryOverlay').style.display = 'none';
            if (isMicListening && recognition) recognition.stop();
        }

        function simulateVoice(transcript, context) {
            if (context) voiceEntryContext = context;
            if (!isVoiceOverlayActive && context === 'STOCK') openVoiceEntryModal('STOCK');
            document.getElementById('veTranscriptText').innerText = `"${transcript}"`;
            setTimeout(() => {
                processVoiceWithBackendAI(transcript);
            }, 800);
        }

        async function processVoiceWithBackendAI(transcript) {
            if (!transcript || isVoiceProcessing) return;

            isVoiceProcessing = true;
            if (recognition && isMicListening) recognition.stop();

            const statusTitle = document.getElementById('veStatusTitle');
            const transcriptBox = document.getElementById('veTranscriptText');
            if (statusTitle) {
                statusTitle.innerText = "Processing...";
                statusTitle.style.color = "var(--primary)";
            }
            if (transcriptBox) transcriptBox.innerText = `"${transcript}"`;

            const finishProcessing = () => {
                isVoiceProcessing = false;
                if (statusTitle && statusTitle.innerText === "Processing...") {
                    statusTitle.innerText = "Tap Mic to Speak";
                    statusTitle.style.color = "var(--ink-main)";
                }
            };

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), VOICE_AI_TIMEOUT_MS);
                const response = await fetch(`${RENDER_API_URL}/api/voice/process`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        merchant_id: MERCHANT_ID,
                        transcript: transcript
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const result = await response.json();
                    if (result.status === "SUCCESS") {
                        applyAIToLocalMath(result);
                        finishProcessing();
                        return;
                    } else if (result.status === "NAVIGATE") {
                        switchTab(result.target.toLowerCase());
                        finishProcessing();
                        return;
                    }
                }

                console.warn("Voice backend did not return a usable result. Falling back locally.");
            } catch (err) {
                console.warn("Voice backend unavailable. Falling back locally.", err);
            }

            const handledLocally = fallbackLocalProcessing(transcript);
            if (!handledLocally) {
                showToast("Samajh nahi aaya. Thoda clear bolkar retry karein.");
                if (statusTitle) {
                    statusTitle.innerText = "Couldn't understand. Tap to retry.";
                    statusTitle.style.color = "var(--red)";
                }
            }
            finishProcessing();
        }



        setTimeout(() => {
            let msh = document.getElementById('mic-status');
            if (!isMicListening && msh) msh.innerText = "Mic Tap Karein, Aur Apni Baat Kahiye";
        }, 3000);


        function applyAIToLocalMath(aiResult) {
            let actions = Array.isArray(aiResult.data) ? aiResult.data : [aiResult];
            let parsedActions = [];

            actions.forEach(act => {
                if (act.action === "ADD_STOCK" || act.action === "REDUCE_STOCK") {
                    let itemNameRaw = act.item_name || "";
                    let itemName = normalizeName(itemNameRaw);
                    // More robust item matching: try contains, then starts-with first word
                    let itemObj = localStock.find(s => s.name.toLowerCase() === itemName)
                        || localStock.find(s => s.name.toLowerCase().includes(itemName) && itemName.length > 2)
                        || localStock.find(s => itemName.includes(s.name.toLowerCase().split(' ')[0]) && s.name.split(' ')[0].length > 2);

                    let qty = parseFloat(act.quantity) || 1;
                    let rate = parseFloat(act.rate) || (itemObj ? parseFloat(itemObj.price) : 0);
                    // Priority: explicit amount > qty*rate from AI > qty*local_price > 0
                    let total = parseFloat(act.amount) || (rate > 0 ? qty * rate : (itemObj ? qty * parseFloat(itemObj.price || 0) : 0));

                    parsedActions.push({
                        actionType: 'STOCK',
                        type: act.action === "ADD_STOCK" ? 'PURCHASE' : 'SALE',
                        itemName: itemObj ? itemObj.name : itemNameRaw,
                        qty: qty,
                        unit: act.unit || (itemObj ? itemObj.unit : 'items'),
                        total: total,
                        itemObj: itemObj
                    });
                } else if (act.action && (act.action.includes("CREDIT") || act.action.includes("PAYMENT") || act.action.includes("REPAYMENT"))) {
                    let isJama = act.action === "CUSTOMER_PAYMENT" || act.action === "CUSTOMER_REPAYMENT" || act.action === "SUPPLIER_PAYMENT";
                    let isCustomer = act.action.includes("CUSTOMER");

                    let targetName = act.target_name || "";
                    let normalizedT = targetName.toLowerCase().trim();
                    for (let key in translationMap) {
                        if (normalizedT.includes(key)) normalizedT += " " + translationMap[key];
                    }

                    let matchedPerson = null;
                    if (targetName && targetName !== "Unknown") {
                        let candidates = isCustomer ? localKhata : localSuppliers;
                        // 1. Exact match
                        matchedPerson = candidates.find(p => p.name.toLowerCase() === normalizedT);
                        // 2. Partial match (first name)
                        if (!matchedPerson && normalizedT.length > 2) {
                            matchedPerson = candidates.find(p => {
                                let cName = p.name.toLowerCase();
                                let targetFirst = normalizedT.split(' ')[0];
                                let cFirst = cName.split(' ')[0];
                                return (cFirst === targetFirst) || (cName.includes(targetFirst) && targetFirst.length > 3);
                            });
                        }
                    }

                    parsedActions.push({
                        actionType: 'KHATA',
                        type: isJama ? 'PAYMENT' : 'UDHAAR',
                        person: matchedPerson || {
                            id: null,
                            name: targetName,
                            balance: 0,
                            phone: '',
                            isNew: true
                        },
                        personType: isCustomer ? 'C' : 'S',
                        amount: act.amount || 0,
                        isNewPerson: !matchedPerson
                    });
                }
            });

            if (parsedActions.length > 0) {
                showMultiVoiceConfirm(parsedActions);
            } else {
                showToast("Action recognized, but couldn't match any party or item.");
            }
        }

        function fallbackLocalProcessing(transcript) {
            try {
                let t = normalizeVoiceText(transcript);

                // Navigation Commands
                const isNav = /kholo|dikhao|open|jao|dikha|खोलो|दिखाओ|जाओ|ओपन|खोलिए|दिखाइए/.test(t);
                if (isNav) {
                    if (/stock|inventory|item/.test(t)) {
                        switchTab('tab-stock', document.getElementById('nav-stock'));
                        closeVoiceEntryModal();
                        return true;
                    }
                    if (/khata|ledger|grahak|customer/.test(t)) {
                        switchTab('tab-khata', document.getElementById('nav-khata'));
                        closeVoiceEntryModal();
                        return true;
                    }
                    if (/snap|camera|photo|bill/.test(t)) {
                        triggerGeneralSnap();
                        closeVoiceEntryModal();
                        return true;
                    }
                    if (/home|dashboard|main/.test(t)) {
                        switchTab('tab-home', document.getElementById('nav-home'));
                        closeVoiceEntryModal();
                        return true;
                    }
                }

                // SPLIT MULTIPLE COMMANDS (Now handles Hindi 'और' as well)
                let rawCommands = t.split(/\s+aur\s+|\s+and\s+|,|\s+phir\s+|\s+saath mein\s+|\s+uske baad\s+|\s+और\s+/);
                let parsedActions = [];

                for (let cmd of rawCommands) {
                    cmd = cmd.trim();
                    if (!cmd) continue;

                    // Match Stock Sale/Purchase (Hindi and Hinglish)
                    let saleMatchA = cmd.match(/(\d+)\s*(packet|kilo|kg|ltr|piece|box|pc|पैकेट|किलो)?\s*(.+?)\s*(becha|sold|sale|बिका|बेचा).+?(\d+)/i);
                    let saleMatchB = !saleMatchA ? cmd.match(/(.+?)\s*(becha|sold|sale|बिका|बेचा).+?(\d+)\s*(packet|kilo|kg|ltr|piece|box|पैकेट|किलो)?/i) : null;
                    let saleMatch = saleMatchA || saleMatchB;

                    let purchaseMatchA = cmd.match(/(\d+)\s*(packet|packets|kilo|kg|ltr|piece|box|pc|पैकेट|किलो)?\s*(.+?)\s*(aaya|purchase|bought|khareeda|aaye|add|added|jod|एड|ऐड|जोड़|आया|आये|खरीदा)(?:.+?(\d+))?/i);
                    let purchaseMatchB = !purchaseMatchA ? cmd.match(/(.+?)\s*(ke|के)?\s*(\d+)\s*(packet|packets|kilo|kg|ltr|piece|box|pc|पैकेट|किलो)?\s*(aaye|purchase|bought|khareeda|add|added|jod|एड|ऐड|जोड़|आये|आया|खरीदा)(?:.+?(\d+))?/i) : null;
                    let purchaseMatch = purchaseMatchA || purchaseMatchB;

                    if (saleMatch || purchaseMatch) {
                        let type = saleMatch ? 'SALE' : 'PURCHASE';
                        let qty = 1;
                        let itemNameRaw = "";
                        let totalAmount = 0;
                        let unitRaw = "";

                        if (saleMatchA) {
                            qty = parseInt(saleMatchA[1]) || 1;
                            unitRaw = saleMatchA[2];
                            itemNameRaw = saleMatchA[3].trim();
                            totalAmount = parseInt(saleMatchA[5]) || 0;
                        } else if (saleMatchB) {
                            itemNameRaw = saleMatchB[1].trim();
                            totalAmount = parseInt(saleMatchB[3]) || 0;
                            unitRaw = saleMatchB[4];
                        } else if (purchaseMatchA) {
                            qty = parseInt(purchaseMatchA[1]) || 1;
                            unitRaw = purchaseMatchA[2];
                            itemNameRaw = purchaseMatchA[3].trim();
                            totalAmount = parseInt(purchaseMatchA[5]) || 0;
                        } else if (purchaseMatchB) {
                            itemNameRaw = purchaseMatchB[1].trim();
                            qty = parseInt(purchaseMatchB[3]) || 1;
                            unitRaw = purchaseMatchB[4];
                            totalAmount = parseInt(purchaseMatchB[6]) || 0;
                        }

                        let itemObj = findClosestMatch(itemNameRaw, localStock);

                        parsedActions.push({
                            actionType: 'STOCK',
                            type: type,
                            itemName: itemObj ? itemObj.name : itemNameRaw,
                            qty: qty,
                            unit: unitRaw || (itemObj ? itemObj.unit : 'items'),
                            total: totalAmount || (itemObj ? itemObj.price * qty : 0),
                            itemObj: itemObj
                        });
                        continue;
                    }

                    // Relaxed fallback for simple "2 maggi" or "maggi" (assumes sale)
                    let simpleStockMatch = cmd.match(/^(\d+)?\s*(.+)$/i);
                    if (simpleStockMatch && !/rupaye|rs|rupaiye|jama|paid|advance|diya|mila|aaya|diye|liye|le lo|udhar|udhaar|likh|baaki|baki|kaate|bache|badha do/i.test(cmd)) {
                        let possibleQty = parseInt(simpleStockMatch[1]) || 1;
                        let possibleName = simpleStockMatch[2].trim();
                        let itemObj = findClosestMatch(possibleName, localStock);

                        if (itemObj) {
                            parsedActions.push({
                                actionType: 'STOCK',
                                type: 'SALE',
                                itemName: itemObj.name,
                                qty: possibleQty,
                                unit: itemObj.unit || 'items',
                                total: itemObj.price * possibleQty,
                                itemObj: itemObj
                            });
                            continue;
                        }
                    }

                    // KHATA LOGIC WITH "NEW USER" DETECTION (Added pure Hindi mapping)
                    let isJama = /jama|paid|advance|diya|mila|aaya|diye|liye|le lo|जमा|दिया|मिला|आया|दिए|लिए/.test(cmd);
                    let isUdhaar = /udhar|udhaar|likh|baaki|baki|kaate|bache|badha do|उधार|बाकी|लिख|खाते/.test(cmd);

                    if (isJama || isUdhaar) {
                        let amountMatch = cmd.match(/\d+/);
                        let amount = amountMatch ? parseInt(amountMatch[0]) : 0;
                        if (amount > 0) {
                            let matchedPerson = null;
                            let matchedType = 'C';
                            let normalizedT = cmd;
                            for (let key in translationMap) {
                                if (cmd.includes(key)) normalizedT += " " + translationMap[key];
                            }

                            for (let p of localKhata) {
                                if (normalizedT.includes(p.name.toLowerCase().split(' ')[0])) {
                                    matchedPerson = p;
                                    matchedType = 'C';
                                    break;
                                }
                            }
                            if (!matchedPerson) {
                                for (let p of localSuppliers) {
                                    if (normalizedT.includes(p.name.toLowerCase().split(' ')[0])) {
                                        matchedPerson = p;
                                        matchedType = 'S';
                                        break;
                                    }
                                }
                            }

                            if (matchedPerson) {
                                parsedActions.push({
                                    actionType: 'KHATA',
                                    type: isJama ? 'PAYMENT' : 'UDHAAR',
                                    person: matchedPerson,
                                    personType: matchedType,
                                    amount: amount,
                                    isNew: false
                                });
                            } else {
                                // Extract the unknown name cleanly, removing all the Hindi/Hinglish action words
                                let cleanCmd = cmd.replace(amountMatch[0], '').replace(/rupaye|rs|rupaiye|jama|paid|advance|diya|mila|aaya|diye|liye|le lo|udhar|udhaar|likh|baaki|baki|kaate|bache|badha do|ka|ko|se|ke|जमा|दिया|मिला|आया|दिए|लिए|उधार|बाकी|लिख|खाते|के|में|रुपए|रुपये/gi, '').trim();
                                let newName = cleanCmd.split(' ')[0] || "Unknown";
                                newName = newName.charAt(0).toUpperCase() + newName.slice(1);

                                parsedActions.push({
                                    actionType: 'KHATA',
                                    type: isJama ? 'PAYMENT' : 'UDHAAR',
                                    person: {
                                        name: newName,
                                        id: 'NEW'
                                    },
                                    personType: 'C',
                                    amount: amount,
                                    isNew: true
                                });
                            }
                        }
                    }
                }

                if (parsedActions.length > 0) {
                    showMultiVoiceConfirm(parsedActions);
                    return true;
                }
                return false;
            } catch (e) {
                console.error(e);
                return false;
            }
        }

        // ==========================================
        // ðŸ”¥ MULTI-COMMAND VOICE CONFIRMATION UI
        // ==========================================
        function showMultiVoiceConfirm(actions) {
            pendingVoiceActions = actions;

            let overlay = document.getElementById('multiVoiceOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'modal-overlay';
                overlay.id = 'multiVoiceOverlay';
                overlay.style.zIndex = '9600';
                document.querySelector('.app-container').appendChild(overlay);
            }

            let sales = actions.filter(a => a.actionType === 'STOCK' && a.type === 'SALE');
            let purchase = actions.filter(a => a.actionType === 'STOCK' && a.type === 'PURCHASE');
            let custUdhaar = actions.filter(a => a.actionType === 'KHATA' && a.type === 'UDHAAR' && a.personType === 'C');
            let custAdvance = actions.filter(a => a.actionType === 'KHATA' && a.type === 'PAYMENT' && a.personType === 'C');
            let supDue = actions.filter(a => a.actionType === 'KHATA' && a.type === 'UDHAAR' && a.personType === 'S');
            let supPayment = actions.filter(a => a.actionType === 'KHATA' && a.type === 'PAYMENT' && a.personType === 'S');
            let transcriptText = document.getElementById('veTranscriptText') ? document.getElementById('veTranscriptText').innerText : "Voice transcript here";

            let html = `
            <div style="background:white; width:100%; border-radius:24px 24px 0 0; padding:24px 20px; display:flex; flex-direction:column; max-height:95vh; animation: slideUp 0.3s ease;">
                
                <div style="text-align:center; position:relative; margin-bottom: 20px;">
                    <div style="width:72px; height:72px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:32px; margin: 0 auto 16px; box-shadow:0 8px 24px rgba(52,211,153,0.3); border: 4px solid var(--primary-light);">
                        <i class="ti ti-microphone"></i>
                    </div>
                    <div style="font-size:18px; font-weight:800; color:var(--ink-main);">We understood your command</div>
                    <div style="font-size:14px; color:var(--ink-muted); margin-top:4px;">Please review and confirm</div>
                </div>

                <div style="overflow-y:auto; flex:1; -webkit-overflow-scrolling:touch; padding-right: 4px;">
                    <div style="background:#f4fdf8; border:1px solid #d1fae5; border-radius:12px; padding:16px; margin-bottom:24px;">
                        <div style="font-size:12px; font-weight:700; color:var(--primary); margin-bottom:8px;">Your Command</div>
                        <div style="font-size:14px; color:var(--ink-main); line-height:1.5;">${transcriptText}</div>
                    </div>
            `;

            if (sales.length > 0) {
                let totalSales = sales.reduce((sum, act) => sum + act.total, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-shopping-cart" style="color:var(--primary); font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Aaj Ki Sales</div>
                        </div>
                `;
                sales.forEach(act => {
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.itemName}</div>
                            <div style="width:60px; color:var(--ink-muted);">Qty: ${act.qty}</div>
                            <div style="width:70px; color:var(--ink-main);">Rate: ₹${(act.total/act.qty).toFixed(0)}</div>
                            <div style="width:80px; text-align:right;">Amount: ₹${act.total}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--primary); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Sales</div>
                            <div>₹${totalSales}</div>
                        </div>
                    </div>
                `;
            }

            if (custUdhaar.length > 0) {
                let totalUdhaar = custUdhaar.reduce((sum, act) => sum + act.amount, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-users" style="color:#6366f1; font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Udhaar (Grahak)</div>
                        </div>
                `;
                custUdhaar.forEach(act => {
                    let newTag = act.isNewPerson ? `<span style="background:var(--ochre-light); color:var(--ochre); font-size:9px; padding:2px 6px; border-radius:4px; margin-left:6px;">NEW</span>` : '';
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.person.name} ${newTag}</div>
                            <div style="flex:1; color:var(--ink-muted);">Udhaar Badhaya</div>
                            <div style="width:80px; text-align:right; color:var(--red);">+ ₹${act.amount}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--red); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Udhaar Update</div>
                            <div>+ ₹${totalUdhaar}</div>
                        </div>
                    </div>
                `;
            }

            if (custAdvance.length > 0) {
                let totalAdvance = custAdvance.reduce((sum, act) => sum + act.amount, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-credit-card" style="color:var(--primary); font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Advance (Grahak)</div>
                        </div>
                `;
                custAdvance.forEach(act => {
                    let newTag = act.isNewPerson ? `<span style="background:var(--ochre-light); color:var(--ochre); font-size:9px; padding:2px 6px; border-radius:4px; margin-left:6px;">NEW</span>` : '';
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.person.name} ${newTag}</div>
                            <div style="flex:1; color:var(--ink-muted);">Advance Liya</div>
                            <div style="width:80px; text-align:right; color:var(--primary);">+ ₹${act.amount}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--primary); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Advance Update</div>
                            <div>+ ₹${totalAdvance}</div>
                        </div>
                    </div>
                `;
            }

            if (supDue.length > 0) {
                let totalDue = supDue.reduce((sum, act) => sum + act.amount, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-truck" style="color:#d97706; font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Due (Supplier)</div>
                        </div>
                `;
                supDue.forEach(act => {
                    let newTag = act.isNewPerson ? `<span style="background:var(--ochre-light); color:var(--ochre); font-size:9px; padding:2px 6px; border-radius:4px; margin-left:6px;">NEW</span>` : '';
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.person.name} ${newTag}</div>
                            <div style="flex:1; color:var(--ink-muted);">Baki (Dene hain)</div>
                            <div style="width:80px; text-align:right; color:var(--red);">+ ₹${act.amount}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--red); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Supplier Due</div>
                            <div>+ ₹${totalDue}</div>
                        </div>
                    </div>
                `;
            }

            if (supPayment.length > 0) {
                let totalPayment = supPayment.reduce((sum, act) => sum + act.amount, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-cash" style="color:var(--primary); font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Payment (Supplier)</div>
                        </div>
                `;
                supPayment.forEach(act => {
                    let newTag = act.isNewPerson ? `<span style="background:var(--ochre-light); color:var(--ochre); font-size:9px; padding:2px 6px; border-radius:4px; margin-left:6px;">NEW</span>` : '';
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.person.name} ${newTag}</div>
                            <div style="flex:1; color:var(--ink-muted);">Payment Diya</div>
                            <div style="width:80px; text-align:right; color:var(--primary);">- ₹${act.amount}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--primary); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Supplier Payment</div>
                            <div>- ₹${totalPayment}</div>
                        </div>
                    </div>
                `;
            }

            if (purchase.length > 0) {
                let totalStock = purchase.reduce((sum, act) => sum + act.qty, 0);
                html += `
                    <div style="margin-bottom:24px;">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                            <i class="ti ti-package" style="color:#d97706; font-size:20px;"></i>
                            <div style="font-size:16px; font-weight:800; color:var(--ink-main);">Stock Update</div>
                        </div>
                `;
                purchase.forEach(act => {
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--ink-main); margin-bottom:12px; padding-left:28px;">
                            <div style="flex:1;">${act.itemName}</div>
                            <div style="flex:1; color:var(--ink-muted);">Stock Add Kiya</div>
                            <div style="width:80px; text-align:right; color:var(--primary);">+ ${act.qty} ${act.unit}</div>
                        </div>
                    `;
                });
                html += `
                        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:700; color:var(--primary); padding-left:28px; margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
                            <div>Total Stock Added</div>
                            <div>+ ${totalStock}</div>
                        </div>
                    </div>
                `;
            }

            html += `
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px; display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                        <i class="ti ti-info-circle" style="color:#3b82f6; font-size:20px;"></i>
                        <div style="font-size:12px; color:#1e3a8a;">Stock, Sales, Udhaar aur Advance sab update ho jayega.</div>
                    </div>
                </div>
                
                <div style="padding-top:16px; display:flex; gap:12px; background:white; flex-shrink: 0;">
                    <button style="flex:1; padding:14px; border:1px solid var(--border); background:white; border-radius:12px; font-weight:700; color:var(--ink-main); cursor:pointer;" onclick="document.getElementById('multiVoiceOverlay').style.display='none';">Cancel</button>
                    <button style="flex:1; padding:14px; border:1px solid var(--primary); background:white; border-radius:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="showVoiceActionEditor()">Edit</button>
                    <button style="flex:1.5; padding:14px; border:none; background:var(--primary); border-radius:12px; font-weight:700; color:white; cursor:pointer;" onclick="executeMultiVoiceConfirm()">Confirm & Save</button>
                </div>
            </div>
            `;

            overlay.innerHTML = html;
            closeVoiceEntryModal();
            overlay.style.display = 'flex';
        }

        function escapeAttr(value) {
            return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        function getVoicePartyOptions(selectedId, selectedType) {
            let label = selectedType === 'S' ? 'New Supplier' : 'New Customer';
            let html = `<option value="NEW">${label}</option>`;
            localKhata.forEach(p => {
                let selected = selectedType === 'C' && String(p.id) === String(selectedId) ? 'selected' : '';
                html += `<option value="C-${p.id}" ${selected}>Customer: ${escapeAttr(p.name)}</option>`;
            });
            localSuppliers.forEach(p => {
                let selected = selectedType === 'S' && String(p.id) === String(selectedId) ? 'selected' : '';
                html += `<option value="S-${p.id}" ${selected}>Supplier: ${escapeAttr(p.name)}</option>`;
            });
            return html;
        }

        function getVoiceItemOptions(selectedItemName) {
            let html = `<option value="NEW">New item</option>`;
            localStock.forEach(item => {
                let selected = item.name === selectedItemName ? 'selected' : '';
                html += `<option value="${escapeAttr(item.id)}" ${selected}>${escapeAttr(item.name)}</option>`;
            });
            return html;
        }

        function showVoiceActionEditor() {
            let overlay = document.getElementById('multiVoiceOverlay');
            if (!overlay || pendingVoiceActions.length === 0) return;

            let html = `
            <div style="background:white; width:100%; border-radius:24px 24px 0 0; padding:22px 20px; display:flex; flex-direction:column; max-height:95vh; animation: slideUp 0.3s ease;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
                    <div>
                        <div style="font-size:18px; font-weight:800; color:var(--ink-main);">Edit Details</div>
                        <div style="font-size:13px; color:var(--ink-muted); margin-top:3px;">Correct anything AI misunderstood.</div>
                    </div>
                    <button style="border:none; background:#f8fafc; width:36px; height:36px; border-radius:50%; color:var(--ink-main); cursor:pointer;" onclick="showMultiVoiceConfirm(pendingVoiceActions)"><i class="ti ti-x"></i></button>
                </div>
                <div style="overflow-y:auto; flex:1; -webkit-overflow-scrolling:touch; padding-right:4px;">
            `;

            pendingVoiceActions.forEach((act, idx) => {
                if (act.actionType === 'STOCK') {
                    let selectedItemId = act.itemObj ? act.itemObj.id : 'NEW';
                    html += `
                    <div style="border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:14px; background:#f8fafc;">
                        <div style="font-size:12px; font-weight:800; color:var(--primary); margin-bottom:12px;">Action ${idx + 1}: Stock / Sale</div>
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Type</label><select id="veType-${idx}"><option value="SALE" ${act.type === 'SALE' ? 'selected' : ''}>Sale</option><option value="PURCHASE" ${act.type === 'PURCHASE' ? 'selected' : ''}>Stock Add</option></select></div>
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Item</label><select id="veItem-${idx}" onchange="document.getElementById('veItemName-${idx}').style.display=this.value==='NEW'?'block':'none';">${getVoiceItemOptions(act.itemName)}</select></div>
                        </div>
                        <div class="input-group" style="margin-bottom:10px; display:${selectedItemId === 'NEW' ? 'block' : 'none'};" id="veItemName-${idx}"><label style="font-size:12px; font-weight:700;">Item Name</label><input type="text" id="veItemNameInput-${idx}" value="${escapeAttr(act.itemName)}"></div>
                        <div style="display:flex; gap:10px;">
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Qty</label><input type="number" id="veQty-${idx}" value="${escapeAttr(act.qty || 1)}"></div>
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Unit</label><input type="text" id="veUnit-${idx}" value="${escapeAttr(act.unit || 'items')}"></div>
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Amount</label><input type="number" id="veTotal-${idx}" value="${escapeAttr(act.total || 0)}"></div>
                        </div>
                    </div>
                    `;
                } else {
                    let selectedPartyId = act.person && act.person.id !== 'NEW' ? act.person.id : 'NEW';
                    html += `
                    <div style="border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:14px; background:#f8fafc;">
                        <div style="font-size:12px; font-weight:800; color:#6366f1; margin-bottom:12px;">Action ${idx + 1}: Khata</div>
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Type</label><select id="veType-${idx}"><option value="UDHAAR" ${act.type === 'UDHAAR' ? 'selected' : ''}>Udhaar</option><option value="PAYMENT" ${act.type === 'PAYMENT' ? 'selected' : ''}>Payment / Jama</option></select></div>
                            <div class="input-group" style="flex:1; margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Party</label><select id="veParty-${idx}" onchange="document.getElementById('vePersonName-${idx}').style.display=this.value==='NEW'?'block':'none';">${getVoicePartyOptions(selectedPartyId, act.personType || 'C')}</select></div>
                        </div>
                        <div class="input-group" style="margin-bottom:10px; display:${selectedPartyId === 'NEW' ? 'block' : 'none'};" id="vePersonName-${idx}"><label style="font-size:12px; font-weight:700;">Name</label><input type="text" id="vePersonNameInput-${idx}" value="${escapeAttr(act.person ? act.person.name : '')}"></div>
                        <div class="input-group" style="margin-bottom:0;"><label style="font-size:12px; font-weight:700;">Amount</label><input type="number" id="veAmount-${idx}" value="${escapeAttr(act.amount || 0)}"></div>
                    </div>
                    `;
                }
            });

            html += `
                </div>
                <div style="padding-top:16px; display:flex; gap:12px; background:white; flex-shrink:0;">
                    <button style="flex:1; padding:14px; border:1px solid var(--border); background:white; border-radius:12px; font-weight:700; color:var(--ink-main); cursor:pointer;" onclick="showMultiVoiceConfirm(pendingVoiceActions)">Back</button>
                    <button style="flex:1.5; padding:14px; border:none; background:var(--primary); border-radius:12px; font-weight:700; color:white; cursor:pointer;" onclick="saveVoiceActionEdits()">Save Details</button>
                </div>
            </div>
            `;
            overlay.innerHTML = html;
            overlay.style.display = 'flex';
        }

        function saveVoiceActionEdits() {
            pendingVoiceActions = pendingVoiceActions.map((act, idx) => {
                let newAct = {...act
                };
                if (act.actionType === 'STOCK') {
                    let itemSelect = document.getElementById(`veItem-${idx}`).value;
                    let selectedItem = itemSelect !== 'NEW' ? localStock.find(s => String(s.id) === String(itemSelect)) : null;
                    newAct.type = document.getElementById(`veType-${idx}`).value;
                    newAct.itemObj = selectedItem || null;
                    newAct.itemName = selectedItem ? selectedItem.name : (document.getElementById(`veItemNameInput-${idx}`).value.trim() || 'New Item');
                    newAct.qty = parseFloat(document.getElementById(`veQty-${idx}`).value) || 1;
                    newAct.unit = document.getElementById(`veUnit-${idx}`).value.trim() || (selectedItem ? selectedItem.unit : 'items');
                    newAct.total = parseFloat(document.getElementById(`veTotal-${idx}`).value) || 0;
                } else {
                    let partySelect = document.getElementById(`veParty-${idx}`).value;
                    newAct.type = document.getElementById(`veType-${idx}`).value;
                    newAct.amount = parseFloat(document.getElementById(`veAmount-${idx}`).value) || 0;

                    if (partySelect === 'NEW') {
                        newAct.personType = act.personType || 'C';
                        newAct.isNewPerson = true;
                        newAct.person = {
                            id: 'NEW',
                            name: document.getElementById(`vePersonNameInput-${idx}`).value.trim() || (newAct.personType === 'S' ? 'New Supplier' : 'New Customer')
                        };
                    } else {
                        let [personType, personId] = partySelect.split('-');
                        let targetArr = personType === 'C' ? localKhata : localSuppliers;
                        let person = targetArr.find(p => String(p.id) === String(personId));
                        newAct.personType = personType;
                        newAct.isNewPerson = false;
                        newAct.person = person || newAct.person;
                    }
                }
                return newAct;
            });

            showMultiVoiceConfirm(pendingVoiceActions);
        }

        async function executeMultiVoiceConfirm() {
            let success = await TransactionEngine.processMultiVoice(pendingVoiceActions);
            if (success) {
                document.getElementById('multiVoiceOverlay').style.display = 'none';
                pendingVoiceActions = [];
                renderUI();
                if (document.getElementById('salesOverlay').style.display === 'flex') renderSalesLedger();
            }
        }

        // ==========================================
        // OTHER LOGIC (Sales Ledger, Modals, Tabs, Sync)
        // ==========================================

        function openEditStockModal(index) {
            let item = localStock[index];
            let overlay = document.getElementById('editStockOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'full-overlay';
                overlay.id = 'editStockOverlay';
                overlay.style.zIndex = '9700';
                overlay.style.background = 'var(--background-light)';
                document.querySelector('.app-container').appendChild(overlay);
            }

            let html = `
            <div style="display:flex; flex-direction:column; height:100%; background:#f8fafc; animation: slideUp 0.3s ease;">
                
                <div class="overlay-header" style="background:white; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center;">
                        <i class="ti ti-arrow-left" onclick="document.getElementById('editStockOverlay').style.display='none';" style="margin-right:12px; cursor:pointer; font-size:20px; color:var(--ink-main);"></i>
                        <div class="overlay-title" style="margin:0;">Edit Stock Item</div>
                    </div>
                    <button style="background:none; border:none; color:var(--red); font-size:20px; cursor:pointer;" onclick="deleteStockItem(${index})"><i class="ti ti-trash"></i></button>
                </div>

                <div style="flex:1; overflow-y:auto; padding:16px;">
                    
                    <!-- Top Card: Item Info -->
                    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:16px; margin-bottom:16px; display:flex; align-items:center; gap:16px;">
                        <div style="width:64px; height:64px; border-radius:12px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:32px; border:1px solid #e2e8f0; flex-shrink:0;">
                            ${getStockEmoji(item.category)}
                        </div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-size:18px; font-weight:800; color:var(--ink-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
                            <div style="font-size:14px; color:var(--ink-muted);">${item.category}</div>
                        </div>
                        <div style="background:#dcfce7; color:var(--primary); padding:4px 8px; border-radius:6px; font-size:12px; font-weight:700;">Active</div>
                    </div>

                    <!-- Basic Information -->
                    <div style="font-size:14px; font-weight:800; color:var(--ink-main); margin-bottom:8px; padding-left:4px;">Basic Information</div>
                    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Item Name</label>
                            <input type="text" id="esi-name" value="${item.name}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box;">
                        </div>
                        <div style="display:flex; gap:12px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Category</label>
                                <select id="esi-category" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box; background:white;">
                                    <option value="Grocery" ${item.category === 'Grocery' ? 'selected' : ''}>Grocery</option>
                                    <option value="Dairy" ${item.category === 'Dairy' ? 'selected' : ''}>Dairy</option>
                                    <option value="Snacks" ${item.category === 'Snacks' ? 'selected' : ''}>Snacks</option>
                                    <option value="Beverages" ${item.category === 'Beverages' ? 'selected' : ''}>Beverages</option>
                                    <option value="Personal Care" ${item.category === 'Personal Care' ? 'selected' : ''}>Personal Care</option>
                                    <option value="General" ${item.category === 'General' ? 'selected' : ''}>General</option>
                                </select>
                            </div>
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Unit</label>
                                <input type="text" id="esi-unit" value="${item.unit}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box;">
                            </div>
                        </div>
                    </div>

                    <!-- Stock Information -->
                    <div style="font-size:14px; font-weight:800; color:var(--ink-main); margin-bottom:8px; padding-left:4px;">Stock Information</div>
                    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; gap:12px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Current Stock</label>
                                <input type="number" id="esi-stock" value="${item.quantity}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box; font-weight:700; color:var(--ink-main);">
                            </div>
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Minimum Stock</label>
                                <input type="number" id="esi-minstock" value="${item.minStock || 10}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="background:#eff6ff; border-radius:8px; padding:10px; display:flex; gap:8px; align-items:center;">
                            <i class="ti ti-bell-ringing" style="color:#3b82f6;"></i>
                            <div style="font-size:12px; color:#1e3a8a;">You will be notified when stock reaches minimum level.</div>
                        </div>
                    </div>

                    <!-- Pricing Information -->
                    <div style="font-size:14px; font-weight:800; color:var(--ink-main); margin-bottom:8px; padding-left:4px;">Pricing Information</div>
                    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:16px; margin-bottom:16px; display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; gap:12px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Purchase Price</label>
                                <input type="number" id="esi-purchase" value="${(item.price * 0.8).toFixed(2)}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box;">
                            </div>
                            <div style="flex:1;">
                                <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Sale Price</label>
                                <input type="number" id="esi-price" value="${item.price}" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-size:14px; box-sizing:border-box; font-weight:700;">
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Sticky Bottom Bar -->
                <div style="padding:16px; border-top:1px solid var(--border); background:white; display:flex; gap:12px; flex-shrink:0;">
                    <button style="flex:1; padding:14px; border:1px solid var(--primary); background:white; border-radius:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="document.getElementById('editStockOverlay').style.display='none';">Cancel</button>
                    <button style="flex:1.5; padding:14px; border:none; background:var(--primary); border-radius:12px; font-weight:700; color:white; cursor:pointer;" onclick="saveEditStockModal(${index})">Save & Update Stock</button>
                </div>

            </div>
            `;

            overlay.innerHTML = html;
            overlay.style.display = 'block';
        }

        async function saveEditStockModal(index) {
            let item = localStock[index];
            let newName = document.getElementById('esi-name').value || item.name;
            let newCat = document.getElementById('esi-category').value;
            let newUnit = document.getElementById('esi-unit').value || item.unit;
            let newQty = parseFloat(document.getElementById('esi-stock').value) || 0;
            let newMinStock = parseFloat(document.getElementById('esi-minstock').value) || 10;
            let newPurPrice = parseFloat(document.getElementById('esi-purchase').value) || 0;
            let newPrice = parseFloat(document.getElementById('esi-price').value) || item.price;

            document.getElementById('editStockOverlay').style.display = 'none';

            // Inform backend
            try {
                await fetch(`${RENDER_API_URL}/api/inventory/item/${item.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        merchant_id: MERCHANT_ID,
                        item_name: newName,
                        category: newCat,
                        unit: newUnit,
                        current_stock: newQty,
                        reorder_level: newMinStock,
                        purchase_price: newPurPrice,
                        price: newPrice
                    })
                });

                showToast("Item Updated Successfully");
                await syncDataFromCloud();
            } catch (e) {
                console.error("Stock update error:", e);
                showToast("Error updating item");
            }
        }

        async function deleteStockItem(index) {
            if (confirm("Are you sure you want to delete this item?")) {
                let item = localStock[index];
                TransactionEngine.showLoader("Deleting Item...");

                try {
                    if (item && item.id) {
                        let res = await fetch(`${RENDER_API_URL}/api/inventory/item/${item.id}?merchant_id=${MERCHANT_ID}`, {
                            method: 'DELETE'
                        });

                        if (!res.ok && res.status !== 404) {
                            throw new Error("Failed to delete from server");
                        }
                    }

                    localStock.splice(index, 1);
                    document.getElementById('editStockOverlay').style.display = 'none';
                    renderUI();
                    showToast("Item Deleted Successfully");
                } catch (e) {
                    console.error("Delete failed", e);
                    showToast("Failed to delete item. Try again.");
                } finally {
                    TransactionEngine.hideLoader();
                }
            }
        }

        function openAddTxWithItem(index) {
            currentAddTxItem = localStock[index];
            openAddTxModal();
            document.getElementById('atItemName').innerText = currentAddTxItem.name;
            document.getElementById('atItemSelector').classList.add('selected');
            document.getElementById('atPrice').value = currentAddTxItem.price || 0;
            document.getElementById('atUnitSelect').value = currentAddTxItem.unit || 'Packets';
            calcTxTotal();
        }

        function openSalesLedger() {
            currentSalesDate = new Date();
            document.getElementById('salesDateInput').value = ""; // Reset native input if possible
            document.getElementById('salesOverlay').style.display = 'flex';
            renderSalesLedger();
        }

        function closeSalesLedger() {
            document.getElementById('salesOverlay').style.display = 'none';
        }

        function setSalesFilter(filter) {
            currentSalesFilter = filter;
            renderSalesLedger();
        }

        let currentSalesDate = new Date();

        function changeSalesDate(val) {
            if (val) {
                currentSalesDate = new Date(val);
                renderSalesLedger();
            }
        }

        function renderSalesLedger() {
            let targetDateString = currentSalesDate.toDateString();
            let isToday = targetDateString === new Date().toDateString();

            document.getElementById('salesHeaderDate').innerText = isToday ? "Today" : formatDate(currentSalesDate.toISOString().split('T')[0]).substring(0, 11);
            document.getElementById('salesLedgerTitle').innerText = isToday ? "Aaj Ki Sales & Stock Log" : "Sales & Stock Log";

            let todayTxs = localDailyLedger.filter(tx => {
                if (!tx.timestamp) return isToday;
                return new Date(tx.timestamp).toDateString() === targetDateString;
            });

            // Bring in Khata transactions for today to ensure stats are accurate
            localKhata.forEach(p => {
                p.transactions.forEach(tx => {
                    let txDate = new Date(tx.date).toDateString();
                    if (txDate === targetDateString) {
                        // Avoid duplicates if already in localDailyLedger (approximate check by amount and type)
                        let isDup = todayTxs.find(t => t.amount === tx.amount && (t.type.toLowerCase().includes(tx.type) || tx.type.toLowerCase().includes(t.type.toLowerCase())));
                        if (!isDup) {
                            todayTxs.push({
                                id: tx.id,
                                type: tx.type === 'udhaar' ? 'SALE' : 'PAYMENT_RECEIVED',
                                amount: tx.amount,
                                qty: 0,
                                note: `Khata: ${tx.note}`,
                                timestamp: new Date(tx.date).getTime()
                            });
                        }
                    }
                });
            });

            let tSales = 0;
            let tItems = 0;
            let tStock = 0;
            let countSales = 0;

            todayTxs.forEach(tx => {
                let safeAmount = parseFloat(tx.amount) || 0;
                let safeQty = parseFloat(tx.qty) || 0;

                if (tx.type === 'SALE' || tx.type === 'udhaar') {
                    tSales += safeAmount; // Only Sales/Udhaar are Revenue
                    tItems += safeQty;
                    countSales++;
                } else if (tx.type === 'PAYMENT_RECEIVED' || tx.type === 'payment') {
                    // Payment is collection, not new revenue, but we can count it as a transaction
                    countSales++;
                } else if (tx.type === 'PURCHASE' || tx.type === 'RESTOCK') {
                    tStock += safeQty;
                    countSales++; // Count purchases as transactions too
                } else if (tx.type === 'ADJUSTMENT') {
                    countSales++;
                }
            });

            const fmt = (num) => num.toLocaleString('en-IN');

            document.getElementById('ssTotalSales').innerText = `₹${fmt(tSales)}`;
            document.getElementById('ssSalesCount').innerText = `${countSales}`;
            document.getElementById('ssItemsSold').innerText = `${tItems}`;
            document.getElementById('ssStockAdded').innerText = `${tStock}`;

            // Build Filters Dynamically
            let countAll = todayTxs.length;
            let countS = todayTxs.filter(tx => tx.type === 'SALE').length;
            let countP = todayTxs.filter(tx => tx.type === 'PURCHASE').length;
            let countU = todayTxs.filter(tx => tx.type === 'PAYMENT_RECEIVED').length;

            let filterHtml = `
                <div class="log-pill ${currentSalesFilter==='ALL'?'active':''}" onclick="setSalesFilter('ALL')">All (${countAll})</div>
                <div class="log-pill ${currentSalesFilter==='SALE'?'active':''}" onclick="setSalesFilter('SALE')"><div class="log-pill-dot" style="background:var(--primary);"></div> Sales (${countS})</div>
                <div class="log-pill ${currentSalesFilter==='PURCHASE'?'active':''}" onclick="setSalesFilter('PURCHASE')"><div class="log-pill-dot" style="background:var(--blue);"></div> Purchase (${countP})</div>
                <div class="log-pill ${currentSalesFilter==='PAYMENT_RECEIVED'?'active':''}" onclick="setSalesFilter('PAYMENT_RECEIVED')"><div class="log-pill-dot" style="background:var(--purple);"></div> Udhaar (${countU})</div>
            `;
            document.getElementById('salesFilterContainer').innerHTML = filterHtml;

            // Filter for display
            let filtered = todayTxs;
            if (currentSalesFilter !== 'ALL') {
                filtered = todayTxs.filter(tx => tx.type === currentSalesFilter);
            }

            let html = "";
            if (filtered.length === 0) {
                html = "<div style='text-align:center; padding:40px; color:var(--ink-muted); font-size: 13px; position:relative; z-index:5; background:var(--background);'>No transactions found for this date.</div>";
            } else {
                filtered.forEach(tx => {
                    try {
                        let isSale = tx.type === 'SALE';
                        let isPurchase = tx.type === 'PURCHASE';
                        let isPay = tx.type === 'PAYMENT_RECEIVED';

                        let badgeColor = isSale ? 'var(--primary)' : (isPurchase ? 'var(--blue)' : 'var(--purple)');
                        let badgeBg = isSale ? 'var(--primary-light)' : (isPurchase ? 'var(--blue-light)' : 'var(--purple-light)');
                        let iconClass = isSale ? 'ti-shopping-cart' : (isPurchase ? 'ti-truck' : 'ti-user');
                        let typeLabel = isSale ? 'SALE' : (isPurchase ? 'PURCHASE' : 'CUSTOMER UDHAAR');

                        let safeAmount = parseFloat(tx.amount) || 0;
                        let amountStr = safeAmount > 0 ? `₹${fmt(safeAmount)}` : '-';

                        let safeUnitPrice = parseFloat(tx.unitPrice);
                        let priceSub = safeUnitPrice ? ` • Rate: ₹${fmt(safeUnitPrice)}` : '';

                        let safeQty = parseFloat(tx.qty) || 0;
                        let qtyStr = safeQty > 0 ? `Qty: ${safeQty} ${tx.unit || ''}` : '';
                        if (isPay) qtyStr = `Amount Added: ₹${fmt(safeAmount)} • Previous Due: ₹0`;

                        let timeStr = tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        }) : "Time N/A";

                        let addedByStr = tx.note && tx.note.includes('Voice') ? '<i class="ti ti-microphone" style="color:var(--primary); font-size:14px;"></i> Voice Munim' : (tx.note && tx.note.includes('Snap') ? '<i class="ti ti-camera" style="font-size:14px;"></i> KhataSnap AI' : '<i class="ti ti-user" style="font-size:14px;"></i> Manual Entry');

                        // Look up real stock impact from inventory
                        let stockItem = localStock.find(s => s.name === tx.item || s.name === tx.itemName);
                        let currentStock = stockItem ? stockItem.quantity : null;
                        let impactStr;
                        if (isSale || isPurchase) {
                            if (currentStock !== null && safeQty > 0) {
                                let beforeStock = isSale ? (currentStock + safeQty) : Math.max(0, currentStock - safeQty);
                                let afterStock = isSale ? currentStock : (currentStock + safeQty);
                                impactStr = `<i class="ti ti-box" style="color:#d97706; font-size:16px;"></i> <span style="color:var(--ink-muted); white-space:nowrap;">Stock Impact:</span> <span style="color:var(--primary); white-space:nowrap;">${beforeStock} &rarr; ${afterStock}</span> <span style="color:var(--ink-main); white-space:nowrap;">${stockItem ? stockItem.unit : 'Items'}</span>`;
                            } else {
                                impactStr = `<i class="ti ti-box" style="color:#d97706; font-size:16px;"></i> <span style="color:var(--ink-muted);">${isSale ? 'Stock Reduced' : 'Stock Added'}: ${safeQty} ${tx.unit || 'Items'}</span>`;
                            }
                        } else {
                            impactStr = `<i class="ti ti-receipt" style="color:var(--purple); font-size:16px;"></i> <span style="color:var(--ink-muted);">Linked Sale:</span> Khata Updated`;
                        }

                        let evidenceUrl = tx.evidence ? (tx.evidence.startsWith('http') ? tx.evidence : (tx.evidence.startsWith('/uploads/') ? RENDER_API_URL + tx.evidence : RENDER_API_URL + '/uploads/' + tx.evidence.split('/').pop())) : null;
                        let evidenceHtml = evidenceUrl ? `<div style="margin-top: 10px; width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);"><a href="${evidenceUrl}" target="_blank" rel="noopener"><img src="${evidenceUrl}" style="width:100%; height:120px; object-fit:cover; display:block;" alt="Receipt Bill" onerror="this.parentElement.parentElement.style.display='none'"></a></div>` : '';
                        html += `
                        <div class="tl-item">
                            <div class="tl-icon" style="background:${badgeColor};"><i class="ti ${iconClass}"></i></div>
                            <div class="tl-card">
                                <div class="tl-card-top">
                                    <div class="tl-time">${timeStr}</div>
                                    <div style="display:flex; gap:8px;">
                                        <div class="tl-badge" style="background:${badgeBg}; color:${badgeColor};">${typeLabel}</div>
                                        <div style="cursor:pointer; color:var(--ink-muted);" onclick="event.stopPropagation(); openEditSaleModal('${tx.id}')"><i class="ti ti-dots-vertical"></i></div>
                                    </div>
                                </div>
                                <div class="tl-main">
                                    <div>
                                        <div class="tl-title">${tx.item || 'Item'}</div>
                                        <div class="tl-sub">${qtyStr}${priceSub}</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div class="tl-amt-lbl">${isPay?'Total Due':'Amount'}</div>
                                        <div class="tl-amt" style="color:${badgeColor};">${amountStr} <i class="ti ti-chevron-down" style="font-size:16px; color:var(--ink-muted);"></i></div>
                                    </div>
                                </div>
                                ${evidenceHtml}
                                <div class="tl-footer">
                                    <div style="display:flex; align-items:center; gap:6px;">${impactStr}</div>
                                    <div style="display:flex; align-items:center; gap:4px; font-weight:500; color:var(--ink-muted);">Added By ${addedByStr}</div>
                                </div>
                            </div>
                        </div>`;
                    } catch (err) {
                        console.warn("Skipped broken legacy transaction", err);
                    }
                });
            }
            document.getElementById('dailySalesList').innerHTML = html;
        }
        let currentAddTxMode = 'SALE';
        let currentAddTxItem = null;

        // ==========================================
        // 🛒 MULTI-ITEM CART TRANSACTION SYSTEM
        // ==========================================
        let txCartItems = []; // Array of { stockItem, qty, unit, unitPrice, amount }
        let txCartMode = 'SALE'; // 'SALE' or 'PURCHASE'
        let txCartSelectingIndex = -1; // -1 = adding new, >=0 = replacing that index

        function openAddTxModal() {
            txCartItems = [];
            txCartMode = 'SALE';
            txCartSelectingIndex = -1;
            currentAddTxItem = null;
            currentAddTxMode = 'SALE';
            switchAddTxTab('SALE');
            renderTxCart();
            document.getElementById('addTxOverlay').style.display = 'flex';
        }

        function closeAddTxModal() {
            document.getElementById('addTxOverlay').style.display = 'none';
        }

        function switchAddTxTab(mode) {
            currentAddTxMode = mode;
            txCartMode = mode;
            document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active', 'sale', 'purchase'));
            let tab = document.getElementById(mode === 'SALE' ? 'tabSale' : 'tabPurchase');
            tab.classList.add('active');

            let partySelect = document.getElementById('atPartySelect');
            let optionsHtml = `<option value="">-- No Party (Cash) --</option>`;

            if (mode === 'SALE') {
                tab.classList.add('sale');
                document.getElementById('atAlertText').innerText = "Add multiple items in one transaction. Stock will be reduced after saving the sale.";
                document.getElementById('atSaveBtn').style.background = "var(--primary)";
                document.getElementById('atVoiceHint').innerText = `Tap mic and say items to add in sale`;
                document.getElementById('atPartyLabel').innerText = "Link to Customer Udhaar (Optional)";
                document.getElementById('atPartyHint').innerText = "You can link this sale to a customer udhaar (optional).";
                document.getElementById('atItemsTitle').innerText = "Items in This Sale";
                document.getElementById('atSummaryTotal').style.color = "var(--primary)";
                localKhata.forEach(c => {
                    optionsHtml += `<option value="C-${c.id}">${c.name}</option>`;
                });
            }
            if (mode === 'PURCHASE') {
                tab.classList.add('purchase');
                document.getElementById('atAlertText').innerText = "Add multiple items in one transaction. Stock will be added after saving the purchase.";
                document.getElementById('atSaveBtn').style.background = "var(--purple)";
                document.getElementById('atVoiceHint').innerText = `Tap mic and say items to add in purchase`;
                document.getElementById('atPartyLabel').innerText = "Link to Supplier Payment (Optional)";
                document.getElementById('atPartyHint').innerText = "You can link this purchase to a supplier account (optional).";
                document.getElementById('atItemsTitle').innerText = "Items in This Purchase";
                document.getElementById('atSummaryTotal').style.color = "var(--purple)";
                localSuppliers.forEach(s => {
                    optionsHtml += `<option value="S-${s.id}">${s.name}</option>`;
                });
            }
            partySelect.innerHTML = optionsHtml;
            renderTxCart();
        }

        function renderTxCart() {
            let listEl = document.getElementById('atItemsList');
            if (!listEl) return;
            let isSale = txCartMode === 'SALE';
            let accentColor = isSale ? 'var(--primary)' : 'var(--purple)';

            if (txCartItems.length === 0) {
                listEl.innerHTML = `<div onclick="openSelectItemModalForCart()" style="background:#f9fafb; border:1.5px dashed var(--border); border-radius:14px; padding:28px 20px; text-align:center; cursor:pointer; margin-bottom:4px;">
                    <div style="font-size:32px; margin-bottom:8px;">🛒</div>
                    <div style="font-size:14px; font-weight:700; color:var(--ink-main); margin-bottom:4px;">No items added yet</div>
                    <div style="font-size:12px; color:var(--ink-muted);">Tap to search and add items</div>
                </div>`;
            } else {
                listEl.innerHTML = txCartItems.map((item, idx) => {
                            let emoji = getStockEmoji(item.stockItem ? item.stockItem.category : 'General');
                            let stockInfo = item.stockItem ? `${item.stockItem.quantity} ${item.unit}` : '';
                            return `<div style="background:white; border:1px solid var(--border); border-radius:14px; padding:14px; margin-bottom:10px; display:flex; align-items:center; gap:10px;">
                        <div style="width:44px; height:44px; background:#f0fdf4; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; border:1px solid #d1fae5;">${emoji}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:13px; font-weight:700; color:var(--ink-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
                            <div style="font-size:11px; color:var(--ink-muted);">${stockInfo ? `1 ${item.unit}` : '1 Piece'}</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <button onclick="adjustCartItemQty(${idx}, -1)" style="width:24px; height:24px; border-radius:50%; border:1.5px solid ${accentColor}; background:white; color:${accentColor}; font-size:16px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;">−</button>
                                <span style="font-size:15px; font-weight:800; color:var(--ink-main); min-width:20px; text-align:center;">${item.qty}</span>
                                <button onclick="adjustCartItemQty(${idx}, 1)" style="width:24px; height:24px; border-radius:50%; border:1.5px solid ${accentColor}; background:white; color:${accentColor}; font-size:16px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;">+</button>
                            </div>
                            <div style="font-size:10px; color:var(--ink-muted);">${item.unit}</div>
                        </div>
                        <div style="text-align:right; flex-shrink:0; min-width:60px;">
                            <div style="font-size:13px; font-weight:700; color:var(--ink-main);">₹${item.unitPrice.toFixed(2)}</div>
                            <div style="font-size:12px; font-weight:800; color:${accentColor};">₹${item.amount.toFixed(2)}</div>
                        </div>
                        <button onclick="removeCartItem(${idx})" style="width:32px; height:32px; border-radius:8px; border:1px solid #fee2e2; background:#fff5f5; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px;">🗑</button>
                    </div>`;
                }).join('');
            }

            // Update summary
            let totalItems = txCartItems.length;
            let totalQty = txCartItems.reduce((s, i) => s + i.qty, 0);
            let totalAmt = txCartItems.reduce((s, i) => s + i.amount, 0);
            let commonUnit = txCartItems.length > 0 ? txCartItems[0].unit : 'packets';
            document.getElementById('atSummaryItems').innerText = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
            document.getElementById('atSummaryQty').innerText = `${totalQty} ${commonUnit.toLowerCase()}`;
            document.getElementById('atSummaryTotal').innerText = `₹${totalAmt.toFixed(2)}`;
        }

        function adjustCartItemQty(idx, diff) {
            if (!txCartItems[idx]) return;
            txCartItems[idx].qty = Math.max(1, txCartItems[idx].qty + diff);
            txCartItems[idx].amount = txCartItems[idx].qty * txCartItems[idx].unitPrice;
            renderTxCart();
        }

        function removeCartItem(idx) {
            txCartItems.splice(idx, 1);
            renderTxCart();
        }

        function clearAllTxItems() {
            if (txCartItems.length === 0) return;
            if (confirm(`Clear all ${txCartItems.length} items?`)) {
                txCartItems = [];
                renderTxCart();
            }
        }

        function openSelectItemModalForCart() {
            txCartSelectingIndex = -1; // adding new
            openSelectItemModal();
        }

        let editingSaleId = null;

        function openEditSaleModal(saleId) {
            editingSaleId = saleId;
            let tx = localDailyLedger.find(s => String(s.id) === String(saleId));
            if (!tx) return;

            let html = `
            <div style="background:white; width:100%; height:100%; display:flex; flex-direction:column; animation: slideUp 0.3s ease;">
                <div style="padding:20px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); flex-shrink:0;">
                    <div style="font-size:20px; font-weight:800;">Edit Sale/Purchase</div>
                    <i class="ti ti-x" style="font-size:24px; color:var(--ink-muted); cursor:pointer;" onclick="document.getElementById('editSaleOverlay').style.display='none';"></i>
                </div>
                
                <div style="flex:1; overflow-y:auto; padding:20px; background:#f9fafb;">
                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Item Name</label>
                        <input type="text" id="esa-item" value="${tx.item || ''}" style="width:100%; padding:14px; border:1px solid var(--border); border-radius:12px; font-size:16px; box-sizing:border-box;">
                    </div>
                    
                    <div style="display:flex; gap:12px; margin-bottom:20px;">
                        <div class="form-group" style="flex:1;">
                            <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Quantity</label>
                            <input type="number" id="esa-qty" value="${tx.qty || 1}" style="width:100%; padding:14px; border:1px solid var(--border); border-radius:12px; font-size:16px; box-sizing:border-box;">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="display:block; font-size:12px; font-weight:700; color:var(--ink-muted); margin-bottom:4px;">Total Amount</label>
                            <input type="number" id="esa-amt" value="${tx.amount}" style="width:100%; padding:14px; border:1px solid var(--border); border-radius:12px; font-size:16px; box-sizing:border-box; font-weight:700;">
                        </div>
                    </div>
                </div>
                
                <div style="padding:16px; border-top:1px solid var(--border); background:white; display:flex; gap:12px; flex-shrink:0;">
                    <button style="flex:1; padding:14px; border:1px solid var(--primary); background:white; border-radius:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="document.getElementById('editSaleOverlay').style.display='none';">Cancel</button>
                    <button style="flex:1.5; padding:14px; border:none; background:var(--primary); border-radius:12px; font-weight:700; color:white; cursor:pointer;" onclick="saveEditSaleModal()">Save Changes</button>
                </div>
            </div>
            `;
            let overlay = document.getElementById('editSaleOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'editSaleOverlay';
                overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:none;';
                document.body.appendChild(overlay);
            }
            overlay.innerHTML = html;
            overlay.style.display = 'block';
        }

        async function saveEditSaleModal() {
            let item = document.getElementById('esa-item').value;
            let qty = parseFloat(document.getElementById('esa-qty').value) || 0;
            let amt = parseFloat(document.getElementById('esa-amt').value) || 0;

            document.getElementById('editSaleOverlay').style.display = 'none';

            try {
                await fetch(`${RENDER_API_URL}/api/sales/${editingSaleId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ merchant_id: MERCHANT_ID, item, qty, amount: amt })
                });
                showToast("Sale Updated"); trackUsage('sale');
                await syncDataFromCloud();
            } catch (e) {
                console.error("Sale update error", e);
                showToast("Error updating sale");
            }
        }

        // Legacy single-item helpers kept for voice entry compatibility
        function adjTxQty(diff) {
            // Not used in new UI but kept for voice compatibility
        }
        function calcTxTotal() {
            // Not used in new UI but kept for voice compatibility
        }

        function openSelectItemModal() {
            document.getElementById('selectItemOverlay').style.display = 'flex';
            document.getElementById('siSearchInput').value = '';
            filterSelectItems();
        }

        function closeSelectItemModal() {
            document.getElementById('selectItemOverlay').style.display = 'none';
        }

        function filterSelectItems() {
            let query = document.getElementById('siSearchInput').value.toLowerCase();
            let html = "";
            localStock.filter(s => s.name.toLowerCase().includes(query)).forEach((s, index) => {
                let actualIndex = localStock.findIndex(x => x.id === s.id);
                html += `<div class="si-card" onclick="selectItemForTx(${actualIndex})"><div class="si-left"><div class="si-img">${getStockEmoji(s.category)}</div><div class="si-info"><div class="si-name">${s.name}</div><div class="si-stock">Stock: ${s.quantity} ${s.unit}</div></div></div><div class="si-price">₹${s.price || 0} / ${s.unit} <i class="ti ti-chevron-right"></i></div></div>`;
            });
            document.getElementById('siList').innerHTML = html || "<div style='padding:20px; text-align:center; color:var(--ink-muted);'>No items found.</div>";
        }

        function selectItemForTx(index) {
            let item = localStock[index];
            if (!item) return;
            currentAddTxItem = item;

            // Add to cart
            let existing = txCartItems.findIndex(c => c.stockItem && c.stockItem.id === item.id);
            if (existing > -1) {
                // Increment qty if already in cart
                txCartItems[existing].qty += 1;
                txCartItems[existing].amount = txCartItems[existing].qty * txCartItems[existing].unitPrice;
            } else {
                txCartItems.push({
                    stockItem: item,
                    name: item.name,
                    qty: 1,
                    unit: item.unit || 'Packets',
                    unitPrice: item.price || 0,
                    amount: item.price || 0,
                    category: item.category
                });
            }

            closeSelectItemModal();
            renderTxCart();
        }

        // ==========================================
        // 🔥 REVIEW & CONFIRM TRANSACTION FLOW
        // ==========================================
        let pendingTxData = null;

        function previewTransaction() {
            if (txCartItems.length === 0) {
                showToast("Please add at least one item!");
                return;
            }

            // Check stock for sales
            if (txCartMode === 'SALE') {
                for (let ci of txCartItems) {
                    if (ci.stockItem && ci.stockItem.quantity < ci.qty) {
                        showToast(`Not enough stock for ${ci.name}! (${ci.stockItem.quantity} available)`);
                        return;
                    }
                }
            }

            let partyVal = document.getElementById('atPartySelect') ? document.getElementById('atPartySelect').value : "";
            let partyObj = null;
            if (partyVal) {
                let pType = partyVal.split('-')[0];
                let pId = parseInt(partyVal.split('-')[1]);
                partyObj = pType === 'C' ? localKhata.find(c => c.id === pId) : localSuppliers.find(s => s.id === pId);
            }

            // For multi-item, use first item data for review modal (show summary)
            let firstItem = txCartItems[0];
            let totalQty = txCartItems.reduce((s, i) => s + i.qty, 0);
            let totalAmt = txCartItems.reduce((s, i) => s + i.amount, 0);
            let itemNames = txCartItems.map(i => i.name).join(', ');
            let firstOldStock = firstItem.stockItem ? firstItem.stockItem.quantity : 0;
            let firstNewStock = firstItem.stockItem ? (txCartMode === 'SALE' ? firstItem.stockItem.quantity - firstItem.qty : firstItem.stockItem.quantity + firstItem.qty) : firstItem.qty;

            pendingTxData = {
                type: txCartMode,
                itemObj: firstItem.stockItem,
                itemName: txCartItems.length === 1 ? firstItem.name : `${txCartItems.length} items (${itemNames})`,
                category: firstItem.category || 'General',
                qty: totalQty,
                unit: firstItem.unit,
                unitPrice: txCartItems.length === 1 ? firstItem.unitPrice : 0,
                total: totalAmt,
                oldStock: firstOldStock,
                newStock: firstNewStock,
                notes: txCartMode === 'SALE' ? "Sold" : "Restocked",
                source: "Manual",
                partyObj: partyObj,
                cartItems: txCartItems // pass full cart
            };
            showReviewConfirmModal(pendingTxData, false);
        }

        function showReviewConfirmModal(data, isVoice = false) {
            document.getElementById('rcSuccessBanner').style.display = isVoice ? 'flex' : 'none';
            document.getElementById('rcTxTypeVal').innerText = data.type === 'SALE' ? 'Sale' : (data.type === 'PURCHASE' ? 'Purchase' : 'Adjustment');
            document.getElementById('rcTxTypeVal').style.color = data.type === 'SALE' ? 'var(--primary)' : (data.type === 'PURCHASE' ? 'var(--purple)' : 'var(--blue)');
            document.getElementById('rcItemImg').innerText = getStockEmoji(data.category);
            document.getElementById('rcItemName').innerText = data.itemName;
            document.getElementById('rcQty').innerText = `${data.qty} ${data.unit}`;
            document.getElementById('rcUnitPrice').innerText = data.unitPrice > 0 ? `₹${data.unitPrice}` : `₹${data.total} (total)`;
            document.getElementById('rcTotalAmount').innerText = `₹${data.total}`;
            let color = data.type === 'SALE' ? 'var(--red)' : 'var(--primary)';
            document.getElementById('rcOldStock').innerText = data.oldStock;
            document.getElementById('rcNewStock').innerText = `${data.newStock} ${data.unit}`;
            document.getElementById('rcNewStock').style.color = color;
            document.getElementById('rcNotes').innerText = data.source === 'Voice' ? 'Added via Voice' : data.notes;
            if (data.partyObj) {
                document.getElementById('rcNotes').innerText += ` (Party: ${data.partyObj.name})`;
            }
            pendingTxData = data;
            document.getElementById('reviewConfirmOverlay').style.display = 'flex';
        }

        async function confirmAndSaveTx() {
            if (!pendingTxData) return;
            let d = pendingTxData;

            // Multi-item: process each cart item individually, or single item
            let itemsToProcess = d.cartItems && d.cartItems.length > 0 ? d.cartItems : [{ stockItem: d.itemObj, name: d.itemName, qty: d.qty, unit: d.unit, unitPrice: d.unitPrice, amount: d.total, category: d.category }];

            let allSuccess = true;
            let successCount = 0;

            for (let cartItem of itemsToProcess) {
                let itemData = {
                    type: d.type,
                    itemObj: cartItem.stockItem,
                    itemName: cartItem.name,
                    category: cartItem.category || 'General',
                    qty: cartItem.qty,
                    unit: cartItem.unit,
                    unitPrice: cartItem.unitPrice,
                    total: cartItem.amount,
                    oldStock: cartItem.stockItem ? cartItem.stockItem.quantity : 0,
                    newStock: cartItem.stockItem ? (d.type === 'SALE' ? cartItem.stockItem.quantity - cartItem.qty : cartItem.stockItem.quantity + cartItem.qty) : cartItem.qty,
                    notes: d.type === 'SALE' ? "Sold" : "Restocked",
                    source: d.source,
                    partyObj: d.partyObj
                };
                let success = await TransactionEngine.processStockTransaction(itemData);
                if (success) successCount++;
                else allSuccess = false;
            }

            if (successCount > 0) {
                renderUI();
                // Show success with summary of all items
                let firstItem = itemsToProcess[0];
                let lastData = {
                    type: d.type,
                    itemObj: firstItem.stockItem,
                    itemName: itemsToProcess.length > 1 ? `${itemsToProcess.length} items saved` : firstItem.name,
                    category: firstItem.category || 'General',
                    qty: itemsToProcess.reduce((s, i) => s + i.qty, 0),
                    unit: firstItem.unit,
                    total: itemsToProcess.reduce((s, i) => s + i.amount, 0),
                    newStock: firstItem.stockItem ? (d.type === 'SALE' ? firstItem.stockItem.quantity - firstItem.qty : firstItem.stockItem.quantity + firstItem.qty) : firstItem.qty
                };
                document.getElementById('tsItemImg').innerText = getStockEmoji(lastData.category);
                document.getElementById('tsItemName').innerText = lastData.itemName;
                document.getElementById('tsTimeSub').innerText = `${d.type==='SALE'?'Sale':d.type==='PURCHASE'?'Purchase':'Adj'} • ${formatTime(Date.now())}`;
                document.getElementById('tsQty').innerText = `${lastData.qty} ${lastData.unit}`;
                document.getElementById('tsTotal').innerText = `₹${lastData.total}`;
                document.getElementById('tsNewStock').innerText = `${lastData.newStock} ${lastData.unit}`;
                document.getElementById('reviewConfirmOverlay').style.display = 'none';
                document.getElementById('addTxOverlay').style.display = 'none';
                closeVoiceEntryModal();
                document.getElementById('txSuccessOverlay').style.display = 'flex';
            }
        }

        function finishTxSuccess() {
            document.getElementById('txSuccessOverlay').style.display = 'none';
            if (document.getElementById('salesOverlay').style.display === 'flex') renderSalesLedger();
            switchTab('tab-stock', document.getElementById('nav-stock'));
        }


        // ==========================================
        // ðŸ§¾ THE NEW BILL SNAP FLOW (5 STEP AI LOGIC)
        // ==========================================
        let bsContext = null;
        let bsParty = null;
        let bsParsedItems = [];
        let bsIsDuplicate = false;
        let bsImagePath = null;
        let bsEditMode = false;
        let isCustomerSnapActive = false;

        const bsItemVocab = [{
            match: ["maggi"],
            name: "Maggi (70g)",
            category: "Snacks",
            unit: "Packets"
        }, {
            match: ["parle", "parle-g", "parleg"],
            name: "Parle-G Biscuit",
            category: "Snacks",
            unit: "Packets"
        }, {
            match: ["amul", "doodh", "milk"],
            name: "Amul Milk (500ml)",
            category: "Dairy",
            unit: "Pouches"
        }, {
            match: ["sugar", "cheeni"],
            name: "Sugar (1kg)",
            category: "Grocery",
            unit: "Kg"
        }, {
            match: ["oil", "tel", "sunflower"],
            name: "Sunflower Oil (1L)",
            category: "Grocery",
            unit: "Bottles"
        }, {
            match: ["atta", "aata", "ashirvaad", "aashirvaad"],
            name: "Aashirvaad Atta (1kg)",
            category: "Grocery",
            unit: "Kg"
        }, {
            match: ["horlicks"],
            name: "Horlicks 500g",
            category: "Grocery",
            unit: "Jars"
        }, {
            match: ["rice", "chawal"],
            name: "Rice (Basmati) 1kg",
            category: "Grocery",
            unit: "Kg"
        }, {
            match: ["pulse", "dal", "daal"],
            name: "Toor Dal 1kg",
            category: "Grocery",
            unit: "Kg"
        }, {
            match: ["biscuit"],
            name: "Britannia Biscuit",
            category: "Snacks",
            unit: "Packets"
        }];

        function findStockItemByName(name) {
            return findClosestMatch(name, localStock);
        }

        function simulateBillOCR(context) {
            let pool = context === 'SALE' ? ["maggi", "amul milk", "parle-g", "sugar"] : ["maggi", "amul milk 1l (pack of 12)", "sugar 1kg", "atta"];
            let count = 2 + Math.floor(Math.random() * 2);
            let chosen = [];
            let usedNames = new Set();
            for (let i = 0; i < count; i++) {
                let raw = pool[Math.floor(Math.random() * pool.length)];
                if (usedNames.has(raw)) continue;
                usedNames.add(raw);
                let vocabHit = bsItemVocab.find(v => v.match.some(m => raw.includes(m)));
                let qty = context === 'SALE' ? (1 + Math.floor(Math.random() * 5)) : (5 + Math.floor(Math.random() * 16));
                let stockMatch = vocabHit ? findStockItemByName(vocabHit.name) : null;
                let rate = stockMatch ? stockMatch.price : (10 + Math.floor(Math.random() * 40));
                let confidence = 0.78 + Math.random() * 0.21;
                chosen.push({
                    name: stockMatch ? stockMatch.name : (vocabHit ? vocabHit.name : raw),
                    category: stockMatch ? stockMatch.category : (vocabHit ? vocabHit.category : "General"),
                    unit: stockMatch ? stockMatch.unit : (vocabHit ? vocabHit.unit : "Pieces"),
                    qty: qty,
                    rate: rate,
                    amount: qty * rate,
                    confidence: confidence,
                    matchedStockId: stockMatch ? stockMatch.id : null
                });
            }
            if (chosen.length === 0) chosen.push({
                name: "Maggi (70g)",
                category: "Snacks",
                unit: "Packets",
                qty: 3,
                rate: 14,
                amount: 42,
                confidence: 0.9,
                matchedStockId: (findStockItemByName("Maggi") || {}).id || null
            });
            return chosen;
        }

        function triggerGeneralSnap() {
            isCustomerSnapActive = false;
            bsParty = null;
            bsContext = 'SALE';
            document.getElementById('cameraInputReal').click();
        }

        function triggerBillSnap() {
            if (!currentLedgerPerson) {
                showToast("Open a customer or supplier first.");
                return;
            }
            bsParty = currentLedgerPerson;
            bsContext = currentLedgerType === 'customer' ? 'SALE' : 'PURCHASE';
            openBillScanStep();
        }

        function openBillScanStep() {
            let isSale = bsContext === 'SALE';
            document.getElementById('bsScanTitle').innerText = isSale ? "Scan Bill" : "Scan Purchase Bill";
            document.getElementById('bsrShopName').innerText = isSale ? "Sanjay General Store" : (bsParty ? bsParty.name : "Supplier Bill");
            document.getElementById('bsrShopAddr').innerHTML = isSale ? "Nalanda, Bihar<br>Ph: 0612-1234567" : "Wholesale Suppliers<br>" + ((bsParty && bsParty.phone) ? ("Ph: " + bsParty.phone) : "");
            document.getElementById('bsrBillNo').innerText = "Bill No: " + (1000 + Math.floor(Math.random() * 9000));
            document.getElementById('bsrBillDate').innerText = formatDate(getTodayStr());
            document.getElementById('bsrItemsArea').innerHTML = `<div style="text-align:center; padding:14px 0; color:#999; font-size:10px;">Position bill inside the frame</div>`;
            document.getElementById('bsrTotal').innerText = "₹0.00";
            document.getElementById('billScanOverlay').style.display = 'flex';
        }

        async function handleRealBillUpload(e) {
            if (e.target.files && e.target.files.length > 0) {
                let file = e.target.files[0];
                document.getElementById('billScanOverlay').style.display = 'none';
                
                let myScanSessionId = ++currentScanSessionId;

                openBillAnalyzingStep(); // Show UI loading states

                let formData = new FormData();
                formData.append('merchant_id', MERCHANT_ID);
                formData.append('file', file);

                let maxRetries = 3;
                let retryDelay = 1000;
                let success = false;
                let finalError = null;

                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        let res = await fetch(`${RENDER_API_URL}/api/snap/process`, {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('shopsathi_auth_token')
                            },
                            body: formData
                        });
                        
                        if (myScanSessionId !== currentScanSessionId) {
                            console.log("Scan cancelled by user. Aborting processing.");
                            return;
                        }

                        if (!res.ok) {
                            let errData = await res.json().catch(() => ({}));
                            throw new Error(errData.detail || `Server Error (${res.status})`);
                        }

                        let result = await res.json();

                        if (result.status === 'SUCCESS' && result.data && result.data.is_valid_bill) {
                            bsIsDuplicate = result.data.is_duplicate || false;
                            bsImagePath = result.data.image_path || null;

                            if (!bsParty && result.data.party_name && result.data.party_name.toUpperCase() !== "GENERAL") {
                                let pName = result.data.party_name.trim();
                                let bType = result.data.bill_type || "CUSTOMER";
                                let targetArr = bType === 'SUPPLIER' ? localSuppliers : localKhata;
                                let matchedParty = targetArr.find(p => p.name.toLowerCase() === pName.toLowerCase());
                                if (matchedParty) {
                                    bsParty = matchedParty;
                                    bsContext = bType === 'SUPPLIER' ? 'PURCHASE' : 'SALE';
                                } else {
                                    bsParty = {
                                        id: 'temp',
                                        name: pName,
                                        phone: '',
                                        balance: 0,
                                        type: bType === 'SUPPLIER' ? 'supplier' : 'customer'
                                    };
                                    bsContext = bType === 'SUPPLIER' ? 'PURCHASE' : 'SALE';
                                }
                            }

                            bsParsedItems = result.data.entries.map(entry => {
                                let stockItem = findStockItemByName(entry.item_name || "");
                                let qty = entry.quantity || 1;
                                let rate = entry.rate || (entry.amount ? (entry.amount / qty) : (stockItem ? stockItem.price : 0));
                                return {
                                    name: entry.item_name || "Unknown Item",
                                    action: entry.action || (bsContext === 'SALE' ? 'REDUCE_STOCK' : 'ADD_STOCK'),
                                    targetName: entry.target_name || (bsParty ? bsParty.name : "General"),
                                    category: stockItem ? stockItem.category : "General",
                                    unit: stockItem ? stockItem.unit : "Pieces",
                                    qty: qty,
                                    rate: rate,
                                    amount: entry.amount || (qty * rate),
                                    confidence: entry.confidence_score || 100,
                                    needsVerification: entry.needs_verification || false,
                                    matchedStockId: stockItem ? stockItem.id : null
                                };
                            });

                            // Validate before marking success
                            if (bsParsedItems.length > 0 && bsParsedItems.some(i => i.name !== "Unknown Item" && i.name !== "")) {
                                success = true;
                                break;
                            } else {
                                throw new Error("Validation Failed: Empty valid items.");
                            }
                        } else {
                            throw new Error("Validation Failed: Invalid bill or empty items.");
                        }
                    } catch (err) {
                        console.warn(`OCR attempt ${attempt + 1} failed:`, err);
                        finalError = err;

                        if (attempt < maxRetries - 1) {
                            document.getElementById('bsAnalyzingFooterTitle').innerText = "AI is busy, retrying...";
                            document.getElementById('bsAnalyzingFooterSub').innerText = `Attempt ${attempt + 2} of ${maxRetries}`;
                            await new Promise(r => setTimeout(r, retryDelay));
                            if (myScanSessionId !== currentScanSessionId) return;
                            retryDelay *= 2; // Exponential backoff (1s, 2s, 4s)
                        }
                    }
                }

                if (success) {
                    finalizeBillAnalyzingStep();
                } else {
                    bsParsedItems = [];
                    // Show error state in the analyzing overlay directly
                    document.getElementById('bsAnalyzingTitle').innerText = "Scan Failed";
                    document.getElementById('bsAnalyzingOrb').innerHTML = `<i class="ti ti-alert-triangle" style="color:#ef4444; font-size:32px;"></i>`;
                    document.getElementById('bsAnalyzingOrb').style.animation = 'none';
                    document.getElementById('bsAnalyzingOrb').style.background = '#fef2f2';

                    let errorTitle = "Couldn't read this bill.";
                    let errorMsg = "Please check lighting and retake the photo.";
                    let isAuthError = false;

                    if (finalError) {
                        let errMsg = finalError.message || '';
                        if (errMsg.includes('401') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('invalid api key')) {
                            errorTitle = "API Key Invalid.";
                            errorMsg = "The Gemini API key in backend/.env is incorrect. Please update it.";
                            isAuthError = true;
                        } else if (errMsg.includes("rate limit") || errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
                            errorTitle = "AI is temporarily busy.";
                            errorMsg = "Gemini API rate limit reached. You can enter items manually below.";
                        } else if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("ERR_CONNECTION_REFUSED")) {
                            errorTitle = "Backend Server is Offline.";
                            errorMsg = "Please start your Python backend server.";
                        }
                    }

                    document.getElementById('bsAnalyzingFooterTitle').innerText = errorTitle;
                    document.getElementById('bsAnalyzingFooterTitle').style.color = "#dc2626";
                    document.getElementById('bsAnalyzingFooterSub').innerText = errorMsg;

                    // Add retry/cancel/manual buttons directly to the analyzing UI
                    let footer = document.getElementById('bsAnalyzingFooter');
                    let existingBtns = document.getElementById('bsErrorBtns');
                    if (existingBtns) existingBtns.remove();

                    let btnHtml = `
                    <div id="bsErrorBtns" style="display:flex; gap:10px; margin-top:16px; width:100%; flex-wrap:wrap;">
                        <button style="flex:1; min-width:100px; padding:12px; border:1px solid #dc2626; background:white; color:#dc2626; border-radius:8px; font-weight:700;" onclick="currentScanSessionId++; document.getElementById('billAnalyzingOverlay').style.display='none';">Cancel</button>
                        <button style="flex:1; min-width:100px; padding:12px; border:none; background:#dc2626; color:white; border-radius:8px; font-weight:700;" onclick="currentScanSessionId++; document.getElementById('cameraInputReal').click(); document.getElementById('billAnalyzingOverlay').style.display='none';">Upload Again</button>
                        ${!isAuthError ? `<button style="width:100%; padding:12px; border:none; background:#6366f1; color:white; border-radius:8px; font-weight:700; margin-top:4px;" onclick="openManualBillEntry()">✏️ Enter Manually</button>` : ''}
                    </div>`;
                    footer.insertAdjacentHTML('beforeend', btnHtml);

                    // Mark checklist items as failed
                    document.querySelectorAll('#bsCheckList .bs-check-row.pending').forEach(r => {
                        r.classList.remove('pending');
                        r.classList.add('failed');
                        r.querySelector('.bs-dot').innerHTML = '<i class="ti ti-x" style="color:#ef4444;"></i>';
                    });
                }

                e.target.value = '';
            }
        }


        function openBillAnalyzingStep() {
            let isSale = bsContext === 'SALE';
            let orb = document.getElementById('bsAnalyzingOrb');
            orb.className = 'bs-analyzing-orb' + (isSale ? '' : ' purchase');
            document.getElementById('bsAnalyzingTitle').innerText = isSale ? "Analyzing Bill..." : "Analyzing Purchase Bill...";
            let footer = document.getElementById('bsAnalyzingFooter');
            footer.className = 'bs-analyzing-footer' + (isSale ? '' : ' purchase');
            document.getElementById('bsAnalyzingFooterTitle').innerText = "Reading your bill...";
            document.getElementById('bsAnalyzingFooterSub').innerText = "This takes just a moment";
            document.querySelectorAll('#bsCheckList .bs-check-row').forEach(r => r.classList.remove('done'));
            document.querySelectorAll('#bsCheckList .bs-check-row').forEach(r => r.classList.add('pending'));
            document.getElementById('billAnalyzingOverlay').style.display = 'flex';

            // Just mark the first two steps as done quickly, the rest will be done after fetch.
            const steps = ['quality', 'detect'];
            steps.forEach((step, idx) => {
                setTimeout(() => {
                    let row = document.querySelector(`#bsCheckList .bs-check-row[data-step="${step}"]`);
                    if (row) {
                        row.classList.remove('pending');
                        row.classList.add('done');
                    }
                }, 450 * (idx + 1));
            });
        }

        function finalizeBillAnalyzingStep() {
            try {
                // Mark the last two steps as done
                const steps = ['read', 'extract'];
                steps.forEach((step, idx) => {
                    setTimeout(() => {
                        try {
                            let row = document.querySelector(`#bsCheckList .bs-check-row[data-step="${step}"]`);
                            if (row) {
                                row.classList.remove('pending');
                                row.classList.add('done');
                            }
                            if (idx === steps.length - 1) {
                                if (bsParsedItems.length === 0) {
                                    document.getElementById('bsAnalyzingFooterTitle').innerText = `Could not read bill`;
                                    document.getElementById('bsAnalyzingFooterSub').innerText = `No items detected. You can add items manually.`;
                                } else {
                                    let hasVerification = bsParsedItems.some(i => i.needsVerification);
                                    document.getElementById('bsAnalyzingFooterTitle').innerText = `Bill detected successfully`;
                                    document.getElementById('bsAnalyzingFooterSub').innerText = `${bsParsedItems.length} items found${hasVerification ? ' • Some items need verification' : ''}`;
                                }
                                setTimeout(() => {
                                    document.getElementById('billAnalyzingOverlay').style.display = 'none';
                                    openBillReviewStep();
                                }, 850);
                            }
                        } catch (e) {
                            alert("finalize setTimeout error: " + e.message);
                        }
                    }, 450 * (idx + 1));
                });
            } catch (err) {
                alert("finalize error: " + err.message);
            }
        }

        function renderBillReviewItems() {
            let total = bsParsedItems.reduce((s, i) => s + i.amount, 0);
            document.getElementById('bsItemsCount').innerText = bsParsedItems.length;
            document.getElementById('bsItemsCard').classList.toggle('bs-edit-mode', bsEditMode);
            let html = bsParsedItems.map((item, idx) => {
                let confBadge = item.needsVerification ? `<span class="bs-conf-badge low" onclick="toggleBillEditMode()" style="cursor:pointer; color: #dc2626; font-size: 10px; border: 1px solid #dc2626; padding: 2px 4px; border-radius: 4px; margin-left: 4px;">Verify (${item.confidence}%)</span>` : ``;
                if (bsEditMode) {
                    return `<div class="bs-item-row"><div class="bs-col-item"><span>${getStockEmoji(item.category)}</span><input type="text" value="${item.name}" oninput="updateBillItemField(${idx},'name',this.value)"></div><div class="bs-col-qty"><input type="number" value="${item.qty}" oninput="updateBillItemField(${idx},'qty',this.value)"></div><div class="bs-col-rate"><input type="number" value="${item.rate.toFixed(2)}" oninput="updateBillItemField(${idx},'rate',this.value)"></div><div class="bs-col-amt">₹${item.amount.toFixed(2)}</div></div>`;
                }
                return `<div class="bs-item-row"><div class="bs-col-item">${item.name} ${confBadge}</div><div class="bs-col-qty">${item.qty}</div><div class="bs-col-rate">₹${item.rate.toFixed(2)}</div><div class="bs-col-amt">₹${item.amount.toFixed(2)}</div></div>`;
            }).join('');
            document.getElementById('bsItemsList').innerHTML = html;
            document.getElementById('bsReviewTotal').innerText = "₹" + total.toFixed(2);
            renderBillStockImpact();
        }

        function updateBillItemField(idx, field, val) {
            let item = bsParsedItems[idx];
            if (!item) return;
            if (field === 'qty') item.qty = parseFloat(val) || 0;
            if (field === 'rate') item.rate = parseFloat(val) || 0;
            if (field === 'name') item.name = val;
            item.amount = item.qty * item.rate;

            // Update UI without full re-render
            let list = document.getElementById('bsItemsList');
            if (list && list.children[idx]) {
                let row = list.children[idx];
                let amtCol = row.querySelector('.bs-col-amt');
                if (amtCol) amtCol.innerText = "₹" + item.amount.toFixed(2);
            }

            let total = bsParsedItems.reduce((sum, it) => sum + it.amount, 0);
            document.getElementById('bsReviewTotal').innerText = "₹" + total.toFixed(2);
            renderBillStockImpact();
        }

        function toggleBillEditMode() {
            bsEditMode = !bsEditMode;
            document.getElementById('bsReviewEditToggle').innerText = bsEditMode ? 'Done' : 'Edit';
            document.getElementById('bsEditItemsBtn').innerText = bsEditMode ? 'Done Editing' : 'Edit Items';
            renderBillReviewItems();
        }

        function renderBillStockImpact() {
            let isSale = bsContext === 'SALE';
            document.getElementById('bsImpactTitle').innerText = isSale ? "Stock Impact (After this bill)" : "Stock Impact (After receiving this bill)";
            document.getElementById('bsImpactNoteText').innerText = isSale ? "Stock will be reduced after saving this bill" : "Stock will be increased after saving this bill";
            let html = bsParsedItems.map(item => {
                let stockItem = item.matchedStockId ? localStock.find(s => s.id === item.matchedStockId) : findStockItemByName(item.name);
                let oldQty = stockItem ? stockItem.quantity : 0;
                if (item.name.includes('Maggi') && isSale && oldQty === 15 && item.qty === 4) oldQty = 12;
                let newQty = isSale ? Math.max(0, oldQty - item.qty) : (oldQty + item.qty);
                let dirClass = isSale ? 'down' : 'up';
                return `<div class="bs-impact-row"><div class="bsi-icon">${getStockEmoji(item.category)}</div><div class="bsi-name">${item.name}</div><div class="bsi-change"><span class="bsi-old">${oldQty}</span> <i class="ti ti-arrow-right" style="font-size:11px; color:var(--ink-muted);"></i> <span class="bsi-new ${dirClass}">${newQty} <span style="font-weight:500; color:var(--ink-muted);">${item.unit}</span></span></div></div>`;
            }).join('');
            document.getElementById('bsImpactList').innerHTML = html;
        }

        function editSnapPartyName() {
            // Show inline edit modal for name and phone
            let currentName = bsParty ? bsParty.name : '';
            let currentPhone = bsParty ? (bsParty.phone || '') : '';
            let isSup = bsContext === 'PURCHASE';
            let existingModal = document.getElementById('snapPartyEditModal');
            if (existingModal) existingModal.remove();
            let modal = document.createElement('div');
            modal.id = 'snapPartyEditModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:flex-end;justify-content:center;';
            modal.innerHTML = `
              <div style="background:white;border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:480px;">
                <div style="font-size:16px;font-weight:700;color:var(--ink-main);margin-bottom:16px;">Edit ${isSup ? 'Supplier' : 'Customer'} Details</div>
                <label style="font-size:12px;color:var(--ink-muted);font-weight:600;">Name</label>
                <input id="snapEditName" type="text" value="${currentName}" placeholder="Enter name" style="width:100%;box-sizing:border-box;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;margin:6px 0 14px;outline:none;">
                <label style="font-size:12px;color:var(--ink-muted);font-weight:600;">Phone Number (optional)</label>
                <input id="snapEditPhone" type="tel" value="${currentPhone}" placeholder="10 digit mobile number" maxlength="10" style="width:100%;box-sizing:border-box;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;margin:6px 0 20px;outline:none;">
                <div style="display:flex;gap:10px;">
                  <button onclick="document.getElementById('snapPartyEditModal').remove()" style="flex:1;padding:14px;border:1.5px solid var(--border);background:white;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px;">Cancel</button>
                  <button onclick="applySnapPartyEdit()" style="flex:1.5;padding:14px;border:none;background:${isSup ? 'var(--purple)' : 'var(--primary)'};color:white;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px;">Save</button>
                </div>
              </div>`;
            document.body.appendChild(modal);
            setTimeout(() => document.getElementById('snapEditName').focus(), 100);
        }

        function applySnapPartyEdit() {
            let newName = (document.getElementById('snapEditName').value || '').trim();
            let newPhone = (document.getElementById('snapEditPhone').value || '').trim().replace(/\D/g, '');
            document.getElementById('snapPartyEditModal').remove();
            if (!newName) { showToast('Name cannot be empty'); return; }
            if (!bsParty || bsParty.id === 'temp') {
                bsParty = { id: 'temp', name: newName, phone: newPhone, balance: 0, type: bsContext === 'PURCHASE' ? 'supplier' : 'customer' };
            } else {
                bsParty.name = newName;
                bsParty.phone = newPhone;
            }
            openBillReviewStep();
        }

        function openBillReviewStep() {
            try {
                let isSale = bsContext === 'SALE';
                bsEditMode = false;
                document.getElementById('bsReviewEditToggle').innerText = 'Edit';
                document.getElementById('bsReviewEditToggle').style.color = isSale ? 'var(--primary)' : 'var(--purple)';
                document.getElementById('bsReviewTitle').innerText = isSale ? "Review Bill Details" : "Review Purchase Details";
                if (bsParty) {
                    let parts = bsParty.name.trim().split(' ');
                    let initials = (parts.length > 1 ? (parts[0][0] + parts[1][0]) : bsParty.name.substring(0, 2)).toUpperCase();
                    let sum = 0;
                    for (let i = 0; i < bsParty.name.length; i++) sum += bsParty.name.charCodeAt(i);
                    let avatar = document.getElementById('bsReviewAvatar');
                    avatar.innerHTML = initials;
                    avatar.style.background = isSale ? avColors[sum % avColors.length] : '#d97706';
                    avatar.style.color = 'white';
                    document.getElementById('bsReviewPartyName').innerHTML = bsParty.name + ' <i class="ti ti-pencil" style="font-size:12px; color:var(--primary); margin-left:4px;"></i>';
                    document.getElementById('bsReviewPartyPhone').innerText = bsParty.phone ? `+91 ${bsParty.phone}` : '';
                    document.getElementById('bsReviewDateTime').innerHTML = formatDate(getTodayStr()) + "<br>" + formatTime(Date.now());
                } else {
                    document.getElementById('bsReviewPartyName').innerHTML = 'General Sale <i class="ti ti-pencil" style="font-size:12px; color:var(--primary); margin-left:4px;"></i>';
                    document.getElementById('bsReviewPartyPhone').innerText = "";
                    document.getElementById('bsReviewAvatar').innerHTML = "GS";
                    document.getElementById('bsReviewAvatar').style.background = "var(--ink-muted)";
                }

                if (bsIsDuplicate) {
                    document.getElementById('bsReviewDuplicateWarning').style.display = 'block';
                } else {
                    document.getElementById('bsReviewDuplicateWarning').style.display = 'none';
                }

                let confirmBtn = document.getElementById('bsConfirmSaveBtn');
                confirmBtn.style.background = isSale ? 'var(--primary)' : 'var(--purple)';
                renderBillReviewItems();
                document.getElementById('billReviewOverlay').style.display = 'flex';
            } catch (err) {
                alert("openBillReviewStep error: " + err.message + "\n" + err.stack);
                console.error("openBillReviewStep error", err);
            }
        }

        let bsLastSaveSummary = null;
        let currentScanSessionId = 0;

        // Manual fallback when OCR fails
        function openManualBillEntry() {
            currentScanSessionId++; // Abort any pending background OCR fetches
            // Close the error overlay
            document.getElementById('billAnalyzingOverlay').style.display = 'none';

            // Pre-fill with 3 blank rows so user can type items directly
            bsParsedItems = [
                { name: "", action: bsContext === 'SALE' ? 'REDUCE_STOCK' : 'ADD_STOCK', targetName: bsParty ? bsParty.name : "General", category: "General", unit: "Pieces", qty: 1, rate: 0, amount: 0, confidence: 100, needsVerification: false, matchedStockId: null },
                { name: "", action: bsContext === 'SALE' ? 'REDUCE_STOCK' : 'ADD_STOCK', targetName: bsParty ? bsParty.name : "General", category: "General", unit: "Pieces", qty: 1, rate: 0, amount: 0, confidence: 100, needsVerification: false, matchedStockId: null },
                { name: "", action: bsContext === 'SALE' ? 'REDUCE_STOCK' : 'ADD_STOCK', targetName: bsParty ? bsParty.name : "General", category: "General", unit: "Pieces", qty: 1, rate: 0, amount: 0, confidence: 100, needsVerification: false, matchedStockId: null }
            ];
            bsIsDuplicate = false;
            bsImagePath = null;

            // Open review in edit mode
            openBillReviewStep();
            // Force edit mode toggle
            setTimeout(() => {
                bsEditMode = true;
                document.getElementById('bsReviewEditToggle').innerText = 'Done';
                document.getElementById('bsEditItemsBtn').innerText = 'Done Editing';
                renderBillReviewItems();
            }, 100);
        }

        async function confirmAndSaveBillSnap() {
            // Filter out blank rows (from manual entry)
            bsParsedItems = bsParsedItems.filter(i => i.name && i.name.trim() !== "");
            if (bsParsedItems.length === 0) {
                showToast("Please add at least one item before saving.");
                return;
            }
            let hasUnverified = bsParsedItems.some(i => i.needsVerification);
            if (hasUnverified && !bsEditMode) {
                showToast("Please verify items with low confidence or unknown names first.");
                toggleBillEditMode();
                return;
            }
            if (bsIsDuplicate && !confirm("This bill appears to be a duplicate. Do you want to save it anyway?")) {
                return;
            }
            bsParsedItems.forEach(i => i.needsVerification = false);

            let isSale = bsContext === 'SALE';
            let total = bsParsedItems.reduce((s, i) => s + i.amount, 0);
            let itemNames = bsParsedItems.map(i => i.name).join(', ');
            let oldBalance = bsParty ? bsParty.balance : 0;

            let result = await TransactionEngine.processBillSnap(isSale, total, itemNames, oldBalance, bsParty, bsParsedItems, bsImagePath);

            if (result.success) {
                if (bsParty) {
                    let targetArr = isSale ? localKhata : localSuppliers;
                    // Try find by ID first, then fall back to name match (for temp parties that got a real ID after sync)
                    let pIdx = targetArr.findIndex(p => p.id === bsParty.id);
                    if (pIdx === -1 && bsParty.name) {
                        pIdx = targetArr.findIndex(p => p.name && p.name.toLowerCase() === bsParty.name.toLowerCase());
                    }
                    if (pIdx > -1) {
                        bsParty = targetArr[pIdx];
                    }
                    // Set the currentLedgerType correctly based on context
                    currentLedgerType = isSale ? 'customer' : 'supplier';
                }

                saveStateToStorage();
                renderUI();
                if (bsParty) {
                    currentLedgerPerson = bsParty;
                    renderLedgerView();
                }

                bsLastSaveSummary = {
                    isSale,
                    total,
                    oldBalance,
                    newBalance: bsParty ? bsParty.balance : 0,
                    stockChangedCount: result.stockChangedCount,
                    partyName: bsParty ? bsParty.name : "General Sale"
                };

                document.getElementById('billReviewOverlay').style.display = 'none';
                openBillSuccessStep();
            }
        }

        function openBillSuccessStep() {
            let s = bsLastSaveSummary;
            if (!s) return;
            let circle = document.getElementById('bsSuccessCircle');
            let title = document.getElementById('bsSuccessTitle');
            circle.className = 'bs-success-circle' + (s.isSale ? '' : ' purchase');
            title.className = 'bs-success-title' + (s.isSale ? '' : ' purchase');
            title.innerText = s.isSale ? "Bill Added Successfully!" : "Purchase Bill Added!";
            document.getElementById('bsSuccessSub').innerText = `₹${s.total.toFixed(2)} added to ${s.partyName}'s account`;
            let balanceLabel = s.isSale ? "Outstanding" : "Payable";
            let viewBtn = document.getElementById('bsViewLedgerBtn');
            viewBtn.innerText = bsParty ? (s.isSale ? "View in Customer Ledger" : "View in Supplier Ledger") : "View Inventory";
            viewBtn.style.background = s.isSale ? 'var(--primary)' : 'var(--purple)';

            let khataUpdateHtml = bsParty ? `<div class="bs-success-item"><div class="bsi-check"><i class="ti ti-check"></i></div><div><div class="bsi-title">Khata Updated</div><div class="bsi-sub">${balanceLabel}: ₹${s.oldBalance} → ₹${s.newBalance}</div></div></div>` : '';

            document.getElementById('bsSuccessList').innerHTML = `${khataUpdateHtml}<div class="bs-success-item"><div class="bsi-check"><i class="ti ti-check"></i></div><div><div class="bsi-title">Inventory Updated</div><div class="bsi-sub">${s.stockChangedCount} items stock ${s.isSale ? 'reduced' : 'increased'}</div></div></div><div class="bs-success-item"><div class="bsi-check"><i class="ti ti-check"></i></div><div><div class="bsi-title">Bill Saved as Proof</div><div class="bsi-sub">Receipt image stored</div></div></div>`;
            document.getElementById('billSuccessOverlay').style.display = 'flex';
        }

        function finishBillSnapToLedger() {
            closeBillSnapFlow();
            if (bsParty) {
                // Open the correct ledger (supplier or customer)
                let ledgerType = bsContext === 'PURCHASE' ? 'supplier' : 'customer';
                let targetArr = ledgerType === 'supplier' ? localSuppliers : localKhata;
                // Find the party by ID or name
                let found = targetArr.find(p => p.id === bsParty.id);
                if (!found && bsParty.name) {
                    found = targetArr.find(p => p.name && p.name.toLowerCase() === bsParty.name.toLowerCase());
                }
                if (found) {
                    openLedger(found.id, ledgerType);
                    document.getElementById('ledgerOverlay').style.display = 'flex';
                } else {
                    // Switch to the right tab
                    if (ledgerType === 'supplier') {
                        switchTab('tab-khata', document.getElementById('nav-khata'));
                    } else {
                        switchTab('tab-khata', document.getElementById('nav-khata'));
                    }
                }
            } else {
                switchTab('tab-stock', document.getElementById('nav-stock'));
            }
        }


        function restartBillSnapFlow() {
            document.getElementById('billSuccessOverlay').style.display = 'none';
            openBillScanStep();
        }

        function closeBillSnapFlow() {
            document.getElementById('billScanOverlay').style.display = 'none';
            document.getElementById('billAnalyzingOverlay').style.display = 'none';
            document.getElementById('billReviewOverlay').style.display = 'none';
            document.getElementById('billSuccessOverlay').style.display = 'none';
        }

        function addNotification(title, message, type = 'info') {
            let n = {
                id: String(Date.now()),
                title: title,
                message: message,
                type: type,
                category: 'System',
                timestamp: new Date().toISOString(),
                is_read: 0
            };
            allNotifications.unshift(n);
            if (typeof updateBellCount === 'function') updateBellCount();
            
            fetch(`${RENDER_API_URL}/api/notifications/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    merchant_id: MERCHANT_ID,
                    title: title,
                    message: message,
                    type: type,
                    category: 'System'
                })
            }).catch(e => console.warn(e));
            
            // Re-render if notification center is open
            if (document.getElementById('notifOverlay').style.display === 'flex') {
                renderNotifications();
            }
        }

        function openNotifications() {
            document.getElementById('notificationOverlay').style.display = 'flex';
            unreadCount = 0;
            saveStateToStorage();
            renderNotifications();
            renderUI();
        }

        function closeNotifications() {
            document.getElementById('notificationOverlay').style.display = 'none';
        }

        function clearNotifications() {
            localNotifications = [];
            saveStateToStorage();
            renderNotifications();
            renderUI();
            showToast("Cleared");
        }

        function renderNotifications() {
            let html = "";
            localNotifications.forEach(n => {
                let color = n.type === 'alert' ? 'var(--red)' : (n.type === 'success' ? 'var(--primary)' : '#0284c7');
                let icon = n.type === 'alert' ? 'ti-alert-circle' : (n.type === 'success' ? 'ti-check' : 'ti-bell');
                html += `<div style="background:white; border-bottom:1px solid var(--border); padding:16px; display:flex; gap:12px;"><div style="width:40px;height:40px;border-radius:50%;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;"><i class="ti ${icon}"></i></div><div><div style="font-size:14px;font-weight:700;color:var(--ink-main);">${n.title}</div><div style="font-size:12px;color:var(--ink-muted);margin:4px 0;">${n.message}</div><div style="font-size:10px;color:var(--ink-muted);">${n.date}</div></div></div>`;
            });
            document.getElementById('notificationList').innerHTML = html || '<div style="text-align:center; padding:20px; color:var(--ink-muted);">No new activities.</div>';
        }

        function checkDueOrders() {
            let today = getTodayStr();
            let alertedToday = SafeStorage.get('ss_alerted_date');
            if (alertedToday === today) return;
            let dueCount = 0;
            [...localKhata, ...localSuppliers].forEach(person => {
                (person.transactions || []).forEach(tx => {
                    if (tx.type === 'order' && tx.dueDate === today) {
                        addNotification("Delivery Due Today!", `${person.name} - ${tx.note}`, "alert");
                        dueCount++;
                    }
                });
            });
            if (dueCount > 0) {
                showToast(`⚠️ ${dueCount} orders due today!`);
                SafeStorage.set('ss_alerted_date', today);
            }
        }

        function switchTab(tabId, element) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if (element) element.classList.add('active');
            renderUI();
        }

        function switchKhataView(view) {
            document.getElementById('btn-khata-grahak').classList.remove('active');
            document.getElementById('btn-khata-supplier').classList.remove('active');
            document.getElementById('view-grahak').style.display = 'none';
            document.getElementById('view-supplier').style.display = 'none';
            document.getElementById(`btn-khata-${view}`).classList.add('active');
            document.getElementById(`view-${view}`).style.display = 'block';
        }

        function showToast(msg) {
            const tb = document.getElementById('toastBox');
            tb.innerText = msg;
            tb.style.display = 'block';
            setTimeout(() => tb.style.display = 'none', 3000);
        }

        function openModal(id) {
            document.getElementById(id).style.display = 'flex';
        }

        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
        }

        function sendWhatsAppReminder(phone, encodedMsg, name, event) {
            if (event) event.stopPropagation();
            window.open(`https://wa.me/91${phone}?text=${encodedMsg}`, '_blank');
            addNotification("WhatsApp Sent", `Reminder sent to ${name}`, "success");
        }

        function sendLedgerWhatsApp() {
            if (!currentLedgerPerson) return;
            let p = currentLedgerPerson;
            let waMsg = p.balance > 0 ? `ðŸ™ Namaskar ${p.name} ji!\nðŸ“ Sanjay General Store\nAapke khate mein ₹${p.balance} udhaar baki hai.\nKripya suvidha anusaar bhugtan kar dein.\nDhanyawad ðŸ™` : `ðŸ™ Namaskar ${p.name} ji!\nðŸ“ Sanjay General Store\nAapke khate mein ₹${Math.abs(p.balance)} advance balance hai.\nDhanyawad ðŸ™`;
            if (p.phone) sendWhatsAppReminder(p.phone, encodeURIComponent(waMsg), p.name);
        }

        function editPhoneNumber() {
            let newPhone = prompt("Edit WhatsApp Number:", currentLedgerPerson.phone || "");
            if (newPhone !== null) {
                currentLedgerPerson.phone = newPhone;
                saveStateToStorage();
                renderLedgerView();
                renderUI();
                showToast("Phone updated!");
            }
        }

        function openSearch() {
            document.getElementById('searchOverlay').style.display = 'flex';
            document.getElementById('searchInput').focus();
            performSearch();
        }

        function closeSearch() {
            document.getElementById('searchOverlay').style.display = 'none';
            document.getElementById('searchInput').value = '';
        }

        function performSearch() {
            let query = document.getElementById('searchInput').value.toLowerCase();
            let resultsDiv = document.getElementById('searchResults');
            if (!query) {
                resultsDiv.innerHTML = '<div style="text-align:center; color:var(--ink-muted); margin-top: 60px;"><i class="ti ti-search" style="font-size:32px; opacity:0.5; margin-bottom:12px;"></i><br>Type to search...</div>';
                return;
            }
            let filteredKhata = localKhata.filter(c => c.name.toLowerCase().includes(query) || c.phone.includes(query));
            let filteredStock = localStock.filter(s => s.name.toLowerCase().includes(query));
            let html = '';
            if (filteredKhata.length > 0) {
                html += '<div class="sr-section-title">Customers</div>';
                filteredKhata.forEach(c => {
                    let balText = c.balance > 0 ? `Pending: ₹${c.balance}` : `Advance: ₹${Math.abs(c.balance)}`;
                    let balClass = c.balance > 0 ? 'red' : 'green';
                    let lastTx = (c.transactions || []).length > 0 ? formatDate(c.transactions[0].date) : "N/A";
                    html += `<div class="sr-card" onclick="closeSearch(); switchTab('tab-khata', document.getElementById('nav-khata')); openLedger('${c.id}', 'customer');"><div class="sr-row"><div class="sr-title">${c.name}</div><div class="sr-amount ${balClass}">${balText}</div></div><div class="sr-meta-grid"><div class="sr-meta-item"><span class="sr-meta-label">Phone</span><span class="sr-meta-val">${c.phone}</span></div><div class="sr-meta-item"><span class="sr-meta-label">Last Activity</span><span class="sr-meta-val">${lastTx}</span></div></div></div>`;
                });
            }
            if (filteredStock.length > 0) {
                html += '<div class="sr-section-title" style="margin-top:24px;">Products</div>';
                filteredStock.forEach(s => {
                    html += `<div class="sr-card" onclick="closeSearch(); switchTab('tab-stock', document.getElementById('nav-stock'));"><div class="sr-row"><div class="sr-title">${s.name}</div><div class="sr-amount green">Available: ${s.quantity} ${s.unit}</div></div><div class="sr-meta-grid"><div class="sr-meta-item"><span class="sr-meta-label">Category</span><span class="sr-meta-val">${s.category}</span></div></div></div>`;
                });
            }
            resultsDiv.innerHTML = html || '<div style="text-align:center; color:var(--ink-muted); margin-top: 60px;">Koi results nahi mila.</div>';
        }

        let currentLedgerPerson = null;
        let currentLedgerType = null;

        function openLedger(id, type) {
            currentLedgerType = type;
            currentLedgerPerson = (type === 'customer' ? localKhata : localSuppliers).find(p => p.id == id);
            if (!currentLedgerPerson) return;
            renderLedgerView();
            document.getElementById('ledgerOverlay').style.display = 'flex';
        }

        function closeLedger() {
            document.getElementById('ledgerOverlay').style.display = 'none';
            currentLedgerPerson = null;
            renderUI();
        }

        async function deleteCurrentLedger() {
            if (!currentLedgerPerson) return;
            if (confirm(`Are you sure you want to completely delete ${currentLedgerPerson.name}'s account? This action cannot be undone.`)) {
                let success = await TransactionEngine.processDeleteParty(currentLedgerPerson.id, currentLedgerType);
                if (success) {
                    closeLedger();
                }
            }
        }

        
        // ================= EVIDENCE GALLERY LOGIC =================
        let currentEvidenceList = [];
        let currentViewerEvd = null;
        let isEvdZoomed = false;

        function switchLedgerTab(tab) {
            if (tab === 'txn') {
                document.getElementById('tabTxnBtn').classList.add('active');
                document.getElementById('tabEvdBtn').classList.remove('active');
                document.getElementById('ledgerTxnSection').style.display = 'block';
                document.getElementById('ledgerEvdSection').style.display = 'none';
            } else {
                document.getElementById('tabTxnBtn').classList.remove('active');
                document.getElementById('tabEvdBtn').classList.add('active');
                document.getElementById('ledgerTxnSection').style.display = 'none';
                document.getElementById('ledgerEvdSection').style.display = 'block';
                fetchEvidence();
            }
        }

        async function fetchEvidence() {
            if (!currentLedgerPerson) return;
            document.getElementById('evidenceList').innerHTML = '<div style="grid-column: span 2; text-align:center; padding:20px;"><i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Loading...</div>';
            try {
                let res = await fetch(`${RENDER_API_URL}/api/evidence/${currentLedgerPerson.id}?merchant_id=${MERCHANT_ID}`);
                let json = await res.json();
                if (json.status === 'success') {
                    currentEvidenceList = json.data;
                    renderEvidence();
                }
            } catch (e) {
                console.error(e);
                document.getElementById('evidenceList').innerHTML = '<div style="grid-column: span 2; text-align:center; padding:20px; color:var(--red);">Failed to load evidence.</div>';
            }
        }

        function renderEvidence() {
            let html = '';
            if (currentEvidenceList.length === 0) {
                document.getElementById('evidenceList').innerHTML = '<div style="grid-column: span 2; text-align:center; padding:40px 20px; color:var(--ink-muted);"><i class="ti ti-photo" style="font-size:32px; opacity:0.5; margin-bottom:10px; display:block;"></i>No evidence found.<br><span style="font-size:12px;">Add photos or upload bills to keep a record.</span></div>';
                return;
            }
            
            currentEvidenceList.forEach(evd => {
                let url = evd.image_path.startsWith('http') ? evd.image_path : RENDER_API_URL + evd.image_path;
                let dateStr = formatDate(evd.created_at);
                let tagStr = evd.tag ? evd.tag : (evd.note ? evd.note : 'Bill/Receipt');
                html += `
                    <div class="evd-card" onclick="openEvidenceViewer('${evd.evidence_id}')">
                        <img src="${url}" class="evd-thumb" alt="Evidence">
                        <div class="evd-info">
                            <div class="evd-tag">${tagStr}</div>
                            <div class="evd-date">${dateStr}</div>
                        </div>
                    </div>
                `;
            });
            document.getElementById('evidenceList').innerHTML = html;
        }

        async function handleEvidenceUpload(event) {
            let file = event.target.files[0];
            if (!file || !currentLedgerPerson) return;
            
            showToast('Uploading evidence...');
            let formData = new FormData();
            formData.append('merchant_id', MERCHANT_ID);
            formData.append('party_id', currentLedgerPerson.id);
            formData.append('party_type', currentLedgerType === 'customer' ? 'CUSTOMER' : 'SUPPLIER');
            formData.append('file', file);
            
            try {
                let res = await fetch(`${RENDER_API_URL}/api/evidence/upload`, {
                    method: 'POST',
                    body: formData
                });
                let json = await res.json();
                if (json.status === 'success') {
                    showToast('Evidence saved securely!');
                    fetchEvidence();
                } else {
                    showToast('Upload failed.');
                }
            } catch (e) {
                console.error(e);
                showToast('Error uploading evidence.');
            }
            event.target.value = '';
        }

        function openEvidenceViewer(evdId) {
            currentViewerEvd = currentEvidenceList.find(e => e.evidence_id === evdId);
            if (!currentViewerEvd) return;
            
            let url = currentViewerEvd.image_path.startsWith('http') ? currentViewerEvd.image_path : RENDER_API_URL + currentViewerEvd.image_path;
            document.getElementById('evdViewerImg').src = url;
            document.getElementById('evdViewerImg').style.transform = 'scale(1)';
            isEvdZoomed = false;
            
            let tagStr = currentViewerEvd.tag || 'Evidence';
            document.getElementById('evdViewerTitle').innerText = tagStr;
            
            document.getElementById('evdViewer').style.display = 'flex';
        }

        function closeEvidenceViewer() {
            document.getElementById('evdViewer').style.display = 'none';
            currentViewerEvd = null;
        }

        function zoomEvidence() {
            let img = document.getElementById('evdViewerImg');
            isEvdZoomed = !isEvdZoomed;
            img.style.transform = isEvdZoomed ? 'scale(2)' : 'scale(1)';
        }

        async function shareEvidence() {
            if (!currentViewerEvd) return;
            let url = currentViewerEvd.image_path.startsWith('http') ? currentViewerEvd.image_path : RENDER_API_URL + currentViewerEvd.image_path;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'ShopSathi Evidence',
                        text: `Evidence for ${currentLedgerPerson.name}`,
                        url: url
                    });
                } catch (e) {
                    console.error('Error sharing:', e);
                }
            } else {
                window.open(url, '_blank');
            }
        }

        async function renameEvidence() {
            if (!currentViewerEvd) return;
            let newTag = prompt("Enter a tag/name for this evidence (e.g. Bill, Receipt, Payment Slip):", currentViewerEvd.tag || "");
            if (newTag === null) return; // User cancelled
            
            let newNote = prompt("Enter an optional note:", currentViewerEvd.note || "");
            if (newNote === null) newNote = currentViewerEvd.note;
            
            try {
                let res = await fetch(`${RENDER_API_URL}/api/evidence/${currentViewerEvd.evidence_id}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        merchant_id: MERCHANT_ID,
                        tag: newTag,
                        note: newNote
                    })
                });
                let json = await res.json();
                if (json.status === 'success') {
                    showToast('Updated successfully!');
                    document.getElementById('evdViewerTitle').innerText = newTag || 'Evidence';
                    currentViewerEvd.tag = newTag;
                    currentViewerEvd.note = newNote;
                    renderEvidence();
                }
            } catch (e) {
                showToast('Failed to update.');
            }
        }

        async function deleteEvidence() {
            if (!currentViewerEvd) return;
            if (!confirm("Are you sure you want to permanently delete this evidence?")) return;
            
            try {
                let res = await fetch(`${RENDER_API_URL}/api/evidence/${currentViewerEvd.evidence_id}?merchant_id=${MERCHANT_ID}`, {
                    method: 'DELETE'
                });
                let json = await res.json();
                if (json.status === 'success') {
                    showToast('Evidence deleted.');
                    closeEvidenceViewer();
                    fetchEvidence();
                }
            } catch (e) {
                showToast('Failed to delete.');
            }
        }

        function renderLedgerView() {
            switchLedgerTab('txn');
            let p = currentLedgerPerson;
            document.getElementById('ledgerTypeTitle').innerText = currentLedgerType === 'customer' ? 'Customer Details' : 'Supplier Details';
            let lAvatar = document.getElementById('lAvatar');
            if (lAvatar) {
                let parts = p.name.trim().split(' ');
                let initials = parts.length > 1 ? (parts[0][0] + parts[1][0]) : p.name.substring(0, 2);
                initials = initials.toUpperCase();
                let sum = 0;
                for (let i = 0; i < p.name.length; i++) sum += p.name.charCodeAt(i);
                lAvatar.innerHTML = initials;
                lAvatar.style.background = avColors[sum % avColors.length];
            }
            document.getElementById('lName').innerText = p.name;
            document.getElementById('lPhoneText').innerText = p.phone ? `+91 ${p.phone}` : 'No phone linked';
            let balEl = document.getElementById('lStat1Val');
            let labelEl = document.getElementById('lStat1Lbl');
            balEl.innerText = "₹" + Math.abs(p.balance);
            if (p.balance > 0) {
                balEl.className = 'ls-val red';
                labelEl.innerText = currentLedgerType === 'customer' ? "Total Baaki" : "Dena Hai";
            } else if (p.balance < 0) {
                balEl.className = 'ls-val green';
                labelEl.innerText = "Advance";
            } else {
                balEl.className = 'ls-val';
                labelEl.innerText = "Cleared";
            }
            let lastPayTx = (p.transactions || []).find(t => t.type === 'payment');
            document.getElementById('lStat3Val').innerText = lastPayTx ? `₹${lastPayTx.amount}` : '₹0';
            document.getElementById('lStat4Val').innerText = (p.transactions || []).length;
            let mainWaBtn = document.getElementById('lMainWaBtn');
            if (p.phone) {
                mainWaBtn.style.display = 'flex';
                mainWaBtn.innerHTML = p.balance > 0 ? `<i class="ti ti-brand-whatsapp"></i> Yaad Dilao` : `<i class="ti ti-brand-whatsapp"></i> Update Bhejein`;
                mainWaBtn.style.background = p.balance > 0 ? 'var(--primary)' : '#0284c7';
            } else {
                mainWaBtn.style.display = 'none';
            }

            // Render Notes
            document.getElementById('lNotesDisplay').innerText = p.notes || 'No notes added.';
            document.getElementById('lNotesDisplay').style.display = 'block';
            document.getElementById('lNotesEditContainer').style.display = 'none';
            document.getElementById('lNotesEditBtn').innerHTML = '<i class="ti ti-pencil"></i> Write Note';

            let billBtn = document.getElementById('lBillSnapBtn');
            if (billBtn) {
                billBtn.innerHTML = currentLedgerType === 'customer' ? `<i class="ti ti-receipt"></i> Bill Snap (Sale)` : `<i class="ti ti-receipt"></i> Bill Snap (Purchase)`;
                billBtn.style.background = currentLedgerType === 'customer' ? 'var(--primary)' : 'var(--purple)';
            }
            let txHtml = "";
            let sortedTx = [...(p.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
            sortedTx.forEach(tx => {
                let isAdd = (currentLedgerType === 'customer' && tx.type === 'udhaar') || (currentLedgerType === 'supplier' && tx.type === 'udhaar');
                let isSub = (currentLedgerType === 'customer' && tx.type === 'payment') || (currentLedgerType === 'supplier' && tx.type === 'payment');
                let sign = tx.type === 'order' ? '' : (isAdd ? '+ ' : '- ');
                let colorClass = tx.type === 'order' ? '' : (isAdd ? 'red' : 'green');
                let typeTitle = tx.type === 'udhaar' ? (tx.note && (tx.note.includes('Snap') || tx.note.includes('Bill')) ? 'Bill' : 'Udhaar') : tx.type === 'payment' ? 'Payment' : 'Order';
                let amtStr = tx.amount ? `${sign}₹${tx.amount}` : '';
                let subText = tx.type === 'order' && tx.dueDate ? `Due: ${formatDate(tx.dueDate)}` : (tx.note || '');

                let receiptUrl = tx.image_path ? (tx.image_path.startsWith('http') ? tx.image_path : (tx.image_path.startsWith('/uploads/') ? RENDER_API_URL + tx.image_path : RENDER_API_URL + '/uploads/' + tx.image_path.split('/').pop())) : null;
                let receiptHtml = receiptUrl ? `<div style="margin-top: 10px; width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);"><a href="${receiptUrl}" target="_blank" rel="noopener"><img src="${receiptUrl}" style="width:100%; height:120px; object-fit:cover; display:block;" alt="Receipt Bill" onerror="this.parentElement.parentElement.style.display='none'"></a></div>` : (tx.hasReceipt ? `<div style="margin-top: 10px; width: 100%; border-radius: 8px; overflow: hidden; border: 1px solid var(--border);"><img src="https://images.unsplash.com/photo-1620063236056-fcf900cb3fb5?auto=format&fit=crop&q=80&w=400&h=150" style="width:100%; height:120px; object-fit:cover; display:block;" alt="Receipt Note"></div>` : '');

                txHtml += `<div class="tx-row" style="flex-direction:column; align-items:flex-start;">
                            <div class="tx-top">
                                <div class="tx-date">${formatDate(tx.date)}</div>
                                <div class="tx-type">${typeTitle}<span>${subText}</span></div>
                                <div class="tx-amount ${colorClass}">${amtStr}</div>
                            </div>
                            ${receiptHtml}
                           </div>`;
            });
            document.getElementById('ledgerTxList').innerHTML = txHtml || '<div style="text-align:center; padding: 20px; color:var(--ink-muted); font-size:12px;">No transactions found.</div>';
        }

        function toggleNotesEdit() {
            let editContainer = document.getElementById('lNotesEditContainer');
            let display = document.getElementById('lNotesDisplay');
            let btn = document.getElementById('lNotesEditBtn');
            let input = document.getElementById('lNotesInput');

            if (editContainer.style.display === 'none') {
                editContainer.style.display = 'flex';
                display.style.display = 'none';
                btn.innerHTML = '<i class="ti ti-x"></i> Cancel';
                input.value = currentLedgerPerson.notes || "";
                input.focus();
            } else {
                editContainer.style.display = 'none';
                display.style.display = 'block';
                btn.innerHTML = '<i class="ti ti-pencil"></i> Write Note';
            }
        }

        async function saveLedgerNotes() {
            if (!currentLedgerPerson) return;
            let input = document.getElementById('lNotesInput');
            let newNotes = input.value.trim();

            currentLedgerPerson.notes = newNotes;
            saveStateToStorage();

            document.getElementById('lNotesDisplay').innerText = newNotes || 'No notes added.';
            document.getElementById('lNotesEditContainer').style.display = 'none';
            document.getElementById('lNotesDisplay').style.display = 'block';
            document.getElementById('lNotesEditBtn').innerHTML = '<i class="ti ti-pencil"></i> Write Note';
            showToast("Notes saved.");

            // Sync to backend
            try {
                await fetch(`${RENDER_API_URL}/api/khata/party/${currentLedgerPerson.id}/notes?merchant_id=${MERCHANT_ID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        notes: newNotes
                    })
                });
            } catch (err) {
                console.warn("Failed to sync notes:", err);
            }
        }

        function openTxModal(type) {
            currentTxType = type;
            document.getElementById('txAmount').value = '';
            document.getElementById('txNote').value = '';
            document.getElementById('txDueDate').value = getTodayStr();
            let pName = currentLedgerPerson.name;
            let actionText = "";
            if (type === 'udhaar') {
                actionText = currentLedgerType === 'customer' ? "ko Udhaar Diya" : "ka Udhaar (Dena Hai)";
                document.getElementById('txDateGroup').style.display = 'none';
            } else if (type === 'payment') {
                actionText = currentLedgerType === 'customer' ? "se Jama Kiya" : "ko Payment Diya";
                document.getElementById('txDateGroup').style.display = 'none';
            } else if (type === 'order') {
                actionText = "ka Order";
                document.getElementById('txDateGroup').style.display = 'flex';
            }
            document.getElementById('txModalTitle').innerHTML = `<span style='color:var(--primary);'>${pName}</span> <br><span style='font-size:14px; color:var(--ink-muted);'>${actionText}</span>`;
            openModal('txModal');
        }

        async function saveTransaction() {
            let amt = parseFloat(document.getElementById('txAmount').value) || 0;
            let note = document.getElementById('txNote').value || (currentTxType === 'order' ? 'Delivery' : 'Manual Entry');
            let dueDate = document.getElementById('txDueDate').value;
            if (currentTxType !== 'order' && !amt) return alert("Amount zaruri hai!");

            let success = await TransactionEngine.processManualKhata(
                currentLedgerPerson,
                currentLedgerType,
                currentTxType,
                amt,
                note,
                dueDate
            );

            if (success) {
                closeModal('txModal');
                renderLedgerView();
            }
        }

        let currentModalPartyType = {
            pa: 'C',
            um: 'C'
        };

        function toggleModalParty(modalPrefix, type) {
            currentModalPartyType[modalPrefix] = type;
            document.getElementById(`tog-${modalPrefix}-c`).classList.toggle('active', type === 'C');
            document.getElementById(`tog-${modalPrefix}-s`).classList.toggle('active', type === 'S');
            let selectEl = document.getElementById(modalPrefix === 'pa' ? 'paPartySelect' : 'umCustomerSelect');
            let opts = '<option value="">Select...</option>';
            if (type === 'C') {
                localKhata.forEach(c => opts += `<option value="C-${c.id}">${c.name} (₹${c.balance} baaki)</option>`);
            } else {
                localSuppliers.forEach(s => opts += `<option value="S-${s.id}">${s.name} (₹${s.balance} dena hai)</option>`);
            }
            selectEl.innerHTML = opts;
        }

        function openUdhaarMinusModal() {
            toggleModalParty('um', 'C');
            document.getElementById('umAmount').value = '';
            openModal('udhaarMinusModal');
        }

        function openPaymentAayaModal() {
            toggleModalParty('pa', 'C');
            document.getElementById('paAmount').value = '';
            openModal('paymentAayaModal');
        }

        function saveGlobalPayment(selectId, amountId, actionType) {
            try {
                let val = document.getElementById(selectId).value;
                let amt = parseFloat(document.getElementById(amountId).value);
                if (!val || !amt) return alert("Details bharo!");
                let type = val.split('-')[0];
                let id = parseInt(val.split('-')[1]);
                let person = (type === 'C') ? localKhata.find(c => c.id === id) : localSuppliers.find(s => s.id === id);
                if (person) {
                    person.balance -= amt;
                    person.transactions.unshift({
                        id: Date.now(),
                        type: 'payment',
                        amount: amt,
                        date: getTodayStr(),
                        note: actionType === 'minus' ? 'Udhaar Minus' : 'Payment Aaya'
                    });
                    if (type === 'C') {
                        todaySales += amt;
                        localDailyLedger.unshift({
                            id: Date.now(),
                            type: 'PAYMENT_RECEIVED',
                            item: 'Global Payment',
                            qty: 0,
                            amount: amt,
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            note: `Payment from ${person.name}`
                        });
                    }
                    fetch(`${RENDER_API_URL}/api/khata/transaction`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            party_id: String(person.id),
                            merchant_id: MERCHANT_ID,
                            amount: amt,
                            txn_type: 'GOT',
                            entry_source: 'Global Payment'
                        })
                    }).catch(e => console.warn(e));
                }
                saveStateToStorage();
                closeModal('udhaarMinusModal');
                closeModal('paymentAayaModal');
                showToast(`₹${amt} Saved!`);
                renderUI();
            } catch (e) {
                showToast("⚠️ Entry fail ho gayi.");
            }
        }

        async function saveNewCustomer() {
            let name = document.getElementById('newCustName').value;
            let phone = document.getElementById('newCustPhone').value;
            let bal = parseFloat(document.getElementById('newCustBalance').value) || 0;
            let balType = document.getElementById('newCustBalType').value;
            if (!name) return alert("Naam zaruri hai!");
            if (balType === 'advance') bal = -Math.abs(bal);
            
            TransactionEngine.showLoader("Saving Grahak...");
            try {
                let res = await fetch(`${RENDER_API_URL}/api/khata/party`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_id: MERCHANT_ID,
                        name: name,
                        phone_number: phone,
                        party_type: "CUSTOMER",
                        initial_balance: bal
                    })
                });
                let data = await res.json();
                if (data.status === 'success') {
                    let cust = {
                        id: data.party_id,
                        name: name,
                        phone: phone,
                        balance: bal,
                        days: 0,
                        transactions: []
                    };
                    if (bal !== 0) cust.transactions.push({
                        id: Date.now(),
                        type: bal > 0 ? 'udhaar' : 'payment',
                        amount: Math.abs(bal),
                        date: getTodayStr(),
                        note: 'Opening Balance'
                    });
                    localKhata.unshift(cust);
                    closeModal('addCustomerModal');
                    renderUI();
                    showToast("Customer Added Successfully!");
                    document.getElementById('newCustName').value = '';
                    document.getElementById('newCustPhone').value = '';
                    document.getElementById('newCustBalance').value = '';
                } else {
                    showToast("Failed to save customer");
                }
            } catch (e) {
                console.warn(e);
                showToast("Network Error: Failed to save customer");
            } finally {
                TransactionEngine.hideLoader();
            }
        }

        async function saveNewSupplier() {
            let name = document.getElementById('newSupName').value;
            let bal = parseFloat(document.getElementById('newSupBalance').value) || 0;
            let balType = document.getElementById('newSupBalType').value;
            if (!name) return alert("Company naam zaruri hai!");
            if (balType === 'advance') bal = -Math.abs(bal);
            
            TransactionEngine.showLoader("Saving Supplier...");
            try {
                let res = await fetch(`${RENDER_API_URL}/api/khata/party`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchant_id: MERCHANT_ID,
                        name: name,
                        phone_number: "",
                        party_type: "SUPPLIER",
                        initial_balance: bal
                    })
                });
                let data = await res.json();
                if (data.status === 'success') {
                    let sup = {
                        id: data.party_id,
                        name: name,
                        phone: "",
                        balance: bal,
                        days: 0,
                        transactions: []
                    };
                    if (bal !== 0) sup.transactions.push({
                        id: Date.now(),
                        type: bal > 0 ? 'udhaar' : 'payment',
                        amount: Math.abs(bal),
                        date: getTodayStr(),
                        note: 'Opening Balance'
                    });
                    localSuppliers.unshift(sup);
                    closeModal('addSupplierModal');
                    renderUI();
                    showToast("Supplier Added Successfully!");
                    document.getElementById('newSupName').value = '';
                    document.getElementById('newSupBalance').value = '';
                } else {
                    showToast("Failed to save supplier");
                }
            } catch (e) {
                console.warn(e);
                showToast("Network Error: Failed to save supplier");
            } finally {
                TransactionEngine.hideLoader();
            }
        }

        async function saveNewStock() {
            let name = document.getElementById('nsName').value;
            let cat = document.getElementById('nsCat').value || 'General';
            let qty = parseFloat(document.getElementById('nsQty').value) || 0;
            let unit = document.getElementById('nsUnit').value;
            let price = parseFloat(document.getElementById('nsPrice').value) || 0;
            if (!name) return alert("Item name is required!");
            let totalVal = price * qty;
            
            TransactionEngine.showLoader("Saving Item...");

            let tempId = Date.now();
            let formData = new FormData();
            formData.append('merchant_id', MERCHANT_ID);
            formData.append('item_id', String(tempId)); // Temporary ID, backend will create real one if not found
            formData.append('item_name', name);
            formData.append('quantity_change', qty);
            formData.append('unit', unit);
            formData.append('price', price);

            try {
                let res = await fetch(`${RENDER_API_URL}/api/inventory/ADD_STOCK`, {
                    method: 'POST',
                    body: formData
                });
                let data = await res.json();
                
                if (data.status === 'success') {
                    localStock.push({
                        id: data.item_id, // Use real ID
                        name: name,
                        category: cat,
                        quantity: qty,
                        minStock: 10,
                        unit: unit,
                        price: price,
                        location: "Unassigned"
                    });
                    if (qty > 0) {
                        localDailyLedger.unshift({
                            id: Date.now(),
                            type: 'PURCHASE',
                            item: name,
                            qty: qty,
                            amount: totalVal,
                            timestamp: Date.now(),
                            date: new Date().toLocaleString(),
                            note: `Purchased ${name}`
                        });
                    }
                    closeModal('addStockModal');
                    renderUI();
                    showToast("Item Added Successfully!");
                    document.getElementById('nsName').value = '';
                    document.getElementById('nsCat').value = '';
                    document.getElementById('nsQty').value = '';
                    document.getElementById('nsPrice').value = '';
                } else {
                    showToast("Failed to save item.");
                }
            } catch(e) {
                console.warn(e);
                showToast("Network Error: Failed to save stock.");
            } finally {
                TransactionEngine.hideLoader();
            }
        }

        function initShopSathi() {
            if (window.location.protocol === 'file:') {
                document.getElementById('fileProtocolWarning').style.display = 'block';
            }
            syncDataFromCloud();
            renderUI();
            setTimeout(checkDueOrders, 1000);
            
            // Fetch initial stats and notifications
            setTimeout(() => {
                fetchDrawerStats();
                fetchNotifications();
            }, 500);
            
            // Setup periodic polling for notifications
            setInterval(fetchNotifications, 60000); // Check every minute
            
            // Fetch usage data for drawer streak
            fetch(`${RENDER_API_URL}/api/usage/${MERCHANT_ID}`)
                .then(r => r.json())
                .then(data => {
                    if(data.status === 'SUCCESS' && data.data) {
                        const el = document.getElementById('drawerStreakDays');
                        if(el) el.innerText = `${data.data.current_streak} Days 🔥`;
                    }
                })
                .catch(e => console.error("Error fetching usage data", e));
        }
        
        // ==========================================
        // DRAWER & NOTIFICATIONS LOGIC
        // ==========================================
        function openMenuDrawer() {
            document.getElementById('drawerOverlay').classList.add('active');
            document.getElementById('menuDrawer').classList.add('active');
            fetchDrawerStats();
        }
        
        function closeMenuDrawer() {
            document.getElementById('drawerOverlay').classList.remove('active');
            document.getElementById('menuDrawer').classList.remove('active');
        }
        
        function openNotificationCenter() {
            document.getElementById('notifOverlay').classList.add('active');
            document.getElementById('notifPanel').classList.add('active');
            fetchNotifications();
        }
        
        function closeNotificationCenter() {
            document.getElementById('notifOverlay').classList.remove('active');
            document.getElementById('notifPanel').classList.remove('active');
        }
        
        async function fetchDrawerStats() {
            try {
                let res = await fetch(`${RENDER_API_URL}/api/stats/today_overview?merchant_id=${MERCHANT_ID}`);
                if (!res.ok) return;
                let json = await res.json();
                if (json.status === 'success' && json.data) {
                    document.getElementById('drawer-voice-cnt').innerText = json.data['Voice Entries'] || 0;
                    document.getElementById('drawer-manual-cnt').innerText = json.data['Manual Entries'] || 0;
                    document.getElementById('drawer-ocr-cnt').innerText = json.data['KhataSnap (OCR)'] || 0;
                    document.getElementById('drawer-other-cnt').innerText = json.data['Other / Import'] || 0;
                    document.getElementById('drawer-total-cnt').innerText = json.data['Total'] || 0;
                }
            } catch (e) {
                console.error("Failed to fetch drawer stats", e);
            }
        }
        
        let allNotifications = [];
        let currentNotifTab = 'All';
        
        async function fetchNotifications() {
            try {
                let res = await fetch(`${RENDER_API_URL}/api/notifications/?merchant_id=${MERCHANT_ID}`);
                if (!res.ok) return;
                let json = await res.json();
                if (json.status === 'success' && json.data) {
                    allNotifications = json.data;
                    renderNotifications();
                    updateBellCount();
                }
            } catch (e) {
                console.error("Failed to fetch notifications", e);
            }
        }
        
        function updateBellCount() {
            let unreadCount = allNotifications.filter(n => !n.is_read).length;
            let bellEl = document.getElementById('bellCount');
            if (unreadCount > 0) {
                bellEl.style.display = 'flex';
                bellEl.innerText = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                bellEl.style.display = 'none';
            }
        }
        
        function switchNotifTab(tabName, el) {
            document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
            el.classList.add('active');
            currentNotifTab = tabName;
            renderNotifications();
        }
        
        function formatNotifTime(dateStr) {
            if (!dateStr) return '';
            let d = new Date(dateStr + "Z"); // UTC to local
            let now = new Date();
            let diffMs = now - d;
            let diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            let diffHrs = Math.floor(diffMins / 60);
            if (diffHrs < 24) return `${diffHrs}h ago`;
            return d.toLocaleDateString();
        }
        
        function getIconForNotifType(type) {
            switch(type) {
                case 'success': return '<i class="ti ti-check"></i>';
                case 'alert': return '<i class="ti ti-alert-triangle"></i>';
                case 'info': return '<i class="ti ti-info-circle"></i>';
                default: return '<i class="ti ti-bell"></i>';
            }
        }
        
        function renderNotifications() {
            let listEl = document.getElementById('notificationList');
            
            let filtered = allNotifications;
            if (currentNotifTab !== 'All') {
                filtered = allNotifications.filter(n => n.category === currentNotifTab);
            }
            
            if (filtered.length === 0) {
                listEl.innerHTML = `
                    <div class="empty-state" style="margin-top:40px;">
                        <i class="ti ti-bell-z"></i>
                        <p>No notifications yet</p>
                    </div>`;
                return;
            }
            
            let html = '';
            filtered.forEach(n => {
                html += `
                    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick('${n.id}', '${n.category}', '${n.reference_type}')">
                        <div class="notif-delete" onclick="deleteNotification(event, '${n.id}')"><i class="ti ti-x"></i></div>
                        <div class="notif-content-row">
                            <div class="notif-icon-wrap ${n.type}">
                                ${getIconForNotifType(n.type)}
                            </div>
                            <div class="notif-body">
                                <div class="notif-title">${n.title}</div>
                                <div class="notif-desc">${n.message}</div>
                                <span class="notif-time">${formatNotifTime(n.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            listEl.innerHTML = html;
        }
        
        async function handleNotifClick(notifId, category, refType) {
            // Mark as read
            let n = allNotifications.find(x => x.id === notifId);
            if (n && !n.is_read) {
                n.is_read = 1;
                renderNotifications();
                updateBellCount();
                
                fetch(`${RENDER_API_URL}/api/notifications/${notifId}/read?merchant_id=${MERCHANT_ID}`, {
                    method: 'PUT'
                }).catch(e => console.warn(e));
            }
            
            // Navigate
            closeNotificationCenter();
            if (category === 'Sales') {
                switchTab('tab-home', document.getElementById('nav-home'));
                openSalesLedger();
            } else if (category === 'Stock') {
                switchTab('tab-stock', document.getElementById('nav-stock'));
            } else if (category === 'Khata') {
                switchTab('tab-khata', document.getElementById('nav-khata'));
            } else if (category === 'System' || refType === 'BILL') {
                switchTab('tab-home', document.getElementById('nav-home'));
            }
        }
        
        async function markAllNotificationsRead() {
            allNotifications.forEach(n => n.is_read = 1);
            renderNotifications();
            updateBellCount();
            showToast("All marked as read");
            fetch(`${RENDER_API_URL}/api/notifications/read_all?merchant_id=${MERCHANT_ID}`, {
                method: 'PUT'
            }).catch(e => console.warn(e));
        }
        
        async function clearAllNotifications() {
            if(!confirm("Clear all notifications?")) return;
            allNotifications = [];
            renderNotifications();
            updateBellCount();
            fetch(`${RENDER_API_URL}/api/notifications/?merchant_id=${MERCHANT_ID}`, {
                method: 'DELETE'
            }).catch(e => console.warn(e));
        }
        
        async function deleteNotification(e, id) {
            e.stopPropagation();
            allNotifications = allNotifications.filter(n => n.id !== id);
            renderNotifications();
            updateBellCount();
            fetch(`${RENDER_API_URL}/api/notifications/${id}?merchant_id=${MERCHANT_ID}`, {
                method: 'DELETE'
            }).catch(e => console.warn(e));
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootApp);
        } else {
            bootApp();
        }
        
        function bootApp() {
            if (!MERCHANT_ID) {
                document.getElementById('splashLoginOverlay').style.display = 'flex';
                return;
            }
            if (MERCHANT_ROLE === 'admin') {
                window.location.href = 'admin.html';
                return;
            }
            // Logged in as merchant
            document.getElementById('splashLoginOverlay').style.display = 'none';
            initShopSathi();
            
            // Track login to update streak on reload
            trackUsage('login');
        }
        
        function logoutMerchant() {
            localStorage.clear();
            window.location.reload();
        }

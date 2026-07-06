// ==========================================
        // SYSTEM INIT & CORE DATA
        // ==========================================
        window.onerror = function(message, source, lineno, colno, error) {
            console.error("App Error: " + message + " at line " + lineno);
            return true;
        };
        const RENDER_API_URL = "http://127.0.0.1:8000";
        let MERCHANT_ID = localStorage.getItem('shopsathi_merchant_id') || "";
        let MERCHANT_ROLE = localStorage.getItem('shopsathi_role') || "";
        
        
        let pendingPhone = "";
        
        function validatePhone() {
            let input = document.getElementById('loginPhoneInput');
            let val = input.value.replace(/\D/g, ''); // only digits
            input.value = val;
            
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
                        MERCHANT_ID = data.merchant_id;
                        MERCHANT_ROLE = 'merchant';
                        document.getElementById('splashLoginOverlay').style.display = 'none';
                        initShopSathi();
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ merchant_id: MERCHANT_ID, action: action })
                });
                let data = await res.json();
                if (data.status === 'SUCCESS') {
                    if (action === 'login') {
                        // Update UI with streak
                        let streakCard = document.getElementById('homeStreakCard');
                        if (streakCard) {
                            document.getElementById('homeStreakDays').innerText = `${data.current_streak} Days`;
                            document.getElementById('menuStreakBadge').innerText = `${data.current_streak} Days`;
                            
                            // Badges
                            let title = "Starter";
                            if (data.current_streak >= 90) title = "Champion 👑";
                            else if (data.current_streak >= 30) title = "Power Merchant 💎";
                            else if (data.current_streak >= 15) title = "Smart Merchant 🏅";
                            else if (data.current_streak >= 7) title = "Consistent 🎯";
                            document.getElementById('homeStreakTitle').innerHTML = `Your Daily Streak • <span style="color:var(--primary);">${title}</span>`;
                        }
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
                            localDailyLedger = data.daily_sales.map(s => ({
                                id: s.sale_id,
                                type: s.type,
                                item: s.item,
                                qty: s.qty,
                                amount: s.amount,
                                note: s.note,
                                timestamp: new Date(s.timestamp + 'Z').getTime(), // Handle UTC
                                date: new Date(s.timestamp + 'Z').toLocaleString()
                            }));
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

        
        let mediaRecorder = null;
        let audioChunks = [];
        let audioContext = null;
        let analyser = null;
        let silenceTimer = null;

        async function toggleListening() {
            if (isMicListening) {
                stopRecording();
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const checkSilence = () => {
                    if (!isMicListening) return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
                    let average = sum / bufferLength;

                    if (average < 10) { // Silence threshold
                        if (!silenceTimer) {
                            silenceTimer = setTimeout(() => {
                                console.log("Silence detected, stopping recording");
                                stopRecording();
                            }, 2500); // 2.5 seconds of silence
                        }
                    } else {
                        if (silenceTimer) {
                            clearTimeout(silenceTimer);
                            silenceTimer = null;
                        }
                    }
                    if (isMicListening) requestAnimationFrame(checkSilence);
                };

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstart = () => {
                    isMicListening = true;
                    let ms = document.getElementById('mic-status');
                    if (ms) ms.innerText = "Suno... Munim sun raha hai...";
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.add('listening'));
                    document.getElementById('veStatusTitle').innerText = "Listening... Bolna start karein";
                    document.getElementById('veStatusTitle').style.color = "var(--primary)";
                    checkSilence();
                };

                mediaRecorder.onstop = async () => {
                    isMicListening = false;
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.remove('listening'));
                    if (silenceTimer) {
                        clearTimeout(silenceTimer);
                        silenceTimer = null;
                    }
                    if (audioContext) {
                        audioContext.close();
                        audioContext = null;
                    }
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());

                    document.getElementById('veStatusTitle').innerText = "Processing Voice...";
                    
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await processAudioBlob(audioBlob);
                };

                mediaRecorder.start();

            } catch (err) {
                console.warn('Mic init error:', err);
                isMicListening = false;
                let manualInput = prompt("Voice Entry: Type your command (e.g. '2 kilo aata 100 ka'):");
                if (manualInput) {
                    processVoiceWithBackendAI(manualInput);
                }
            }
        }

        async function processAudioBlob(blob) {
            const formData = new FormData();
            formData.append("audio", blob, "voice.webm");
            
            try {
                const res = await fetch(`${RENDER_API_URL}/api/voice/transcribe`, {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "SUCCESS") {
                        let transcript = data.transcript;
                        document.getElementById('veTranscriptText').innerText = `"${transcript}"`;
                        processVoiceWithBackendAI(transcript);
                    }
                } else {
                    throw new Error("Transcription failed");
                }
            } catch (e) {
                console.error(e);
                showToast("Network Error: Could not process voice");
                document.getElementById('veStatusTitle').innerText = "Tap Mic to Speak";
            }
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
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

        let currentPreviewPayload = null;

        async function processVoiceWithBackendAI(transcript) {
            if (!transcript || isVoiceProcessing) return;

            isVoiceProcessing = true;

            const statusTitle = document.getElementById('veStatusTitle');
            const transcriptBox = document.getElementById('veTranscriptText');
            if (statusTitle) {
                statusTitle.innerText = "Understanding Intent...";
                statusTitle.style.color = "var(--primary)";
            }
            if (transcriptBox) transcriptBox.innerText = `"${transcript}"`;

            const finishProcessing = () => {
                isVoiceProcessing = false;
                if (statusTitle && statusTitle.innerText === "Understanding Intent...") {
                    statusTitle.innerText = "Tap Mic to Speak";
                    statusTitle.style.color = "var(--ink-main)";
                }
            };

            try {
                const response = await fetch(`${RENDER_API_URL}/api/voice/process`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ merchant_id: MERCHANT_ID, transcript: transcript })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.status === "SUCCESS") {
                        currentPreviewPayload = result.preview;
                        showMultiVoiceConfirm(result.preview);
                        finishProcessing();
                        return;
                    } else if (result.status === "NAVIGATE") {
                        switchTab(result.target.toLowerCase(), document.getElementById(`nav-${result.target.toLowerCase()}`));
                        closeVoiceEntryModal();
                        finishProcessing();
                        return;
                    } else {
                        showToast(result.msg || "Kripya dobara bolein");
                        finishProcessing();
                        return;
                    }
                }
            } catch (err) {
                console.warn("Voice processing error", err);
            }
            
            showToast("Samajh nahi aaya. Thoda clear bolkar retry karein.");
            if (statusTitle) {
                statusTitle.innerText = "Couldn't understand. Tap to retry.";
                statusTitle.style.color = "var(--red)";
            }
            finishProcessing();
        }

        function applyAIToLocalMath(aiResult) {
            let actions = Array.isArray(aiResult.data) ? aiResult.data : [aiResult];
            let parsedActions = [];

            actions.forEach(act => {
                if (act.action === "ADD_STOCK" || act.action === "REDUCE_STOCK") {
                    let itemNameRaw = act.item_name || "";
                    let itemName = normalizeName(itemNameRaw);
                    let itemObj = localStock.find(s => s.name.toLowerCase().includes(itemName) || itemName.includes(s.name.toLowerCase().split(' ')[0]));

                    parsedActions.push({
                        actionType: 'STOCK',
                        type: act.action === "ADD_STOCK" ? 'PURCHASE' : 'SALE',
                        itemName: itemObj ? itemObj.name : itemNameRaw,
                        qty: act.quantity || 1,
                        unit: act.unit || (itemObj ? itemObj.unit : 'items'),
                        total: act.amount || (itemObj ? itemObj.price * (act.quantity || 1) : 0),
                        itemObj: itemObj
                    });
                } else if (act.action.includes("CREDIT") || act.action.includes("PAYMENT") || act.action.includes("REPAYMENT")) {
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
        function showMultiVoiceConfirm(preview) {
            closeVoiceEntryModal();
            let overlay = document.getElementById('multiVoiceConfirmOverlay');
            if (!overlay) return;
            overlay.style.display = 'flex';

            let listContainer = document.getElementById('mvc-list');
            listContainer.innerHTML = '';

            if (preview.validation_errors && preview.validation_errors.length > 0) {
                let errDiv = document.createElement('div');
                errDiv.style.color = 'var(--red)';
                errDiv.style.fontSize = '12px';
                errDiv.style.marginBottom = '10px';
                errDiv.innerText = "Errors: " + preview.validation_errors.join(", ");
                listContainer.appendChild(errDiv);
            }

            preview.actions.forEach((act, idx) => {
                let d = document.createElement('div');
                d.className = 'mvc-item';

                if (act.type === 'STOCK') {
                    let stHtml = `
                        <div class="mvc-item-title">${act.item_name} ${act.is_new ? '<span style="color:var(--primary);font-size:10px;">(NEW)</span>' : ''}</div>
                        <div class="mvc-item-sub">
                           ${act.is_sale ? 'Sale' : 'Purchase'} | Qty: ${act.qty} ${act.unit} | ₹${act.price}
                        </div>
                        <div class="mvc-item-sub" style="color:var(--text-light); font-size: 11px;">
                           Stock: ${act.before_stock} → ${act.after_stock}
                        </div>
                    `;
                    d.innerHTML = stHtml;
                } else if (act.type === 'KHATA') {
                    let kHtml = `
                        <div class="mvc-item-title">${act.name} ${act.is_new ? '<span style="color:var(--primary);font-size:10px;">(NEW)</span>' : ''}</div>
                        <div class="mvc-item-sub">
                           ${act.action_raw.includes('PAYMENT') ? 'Payment (Jama)' : 'Credit (Udhaar)'} | ₹${act.amount}
                        </div>
                        <div class="mvc-item-sub" style="color:var(--text-light); font-size: 11px;">
                           Balance: ₹${act.before_balance} → ₹${act.after_balance}
                        </div>
                    `;
                    d.innerHTML = kHtml;
                }
                listContainer.appendChild(d);
            });
            
            if (preview.generate_bill) {
                let bDiv = document.createElement('div');
                bDiv.className = 'mvc-item';
                bDiv.innerHTML = `<div class="mvc-item-title" style="color:var(--primary);"><i class="ti ti-receipt"></i> Generate Digital Bill</div>`;
                listContainer.appendChild(bDiv);
            }

            let btn = document.getElementById('mvc-confirm-btn');
            if (preview.is_valid) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.innerText = `Confirm & Save (Total: ₹${preview.grand_total})`;
                btn.onclick = async () => {
                    btn.innerText = 'Saving...';
                    try {
                        const res = await fetch(`${RENDER_API_URL}/api/voice/execute`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ merchant_id: MERCHANT_ID, preview: currentPreviewPayload })
                        });
                        const data = await res.json();
                        if (data.status === "SUCCESS") {
                            showToast("All transactions saved successfully!");
                            if (data.bill_id) showToast("Bill Generated: " + data.bill_id);
                            
                            // Re-fetch everything to sync UI
                            await fetchInventory();
                            await fetchKhata();
                            closeMultiVoiceConfirm();
                        } else {
                            showToast("Error saving transactions");
                            btn.innerText = 'Confirm & Save';
                        }
                    } catch (e) {
                        showToast("Network error while saving");
                        btn.innerText = 'Confirm & Save';
                    }
                };
            } else {
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
                btn.innerText = 'Cannot Save (Errors Found)';
                btn.onclick = null;
            }
        }

        

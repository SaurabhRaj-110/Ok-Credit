import re

with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

start_process = js.find("async function processVoiceWithBackendAI(transcript)")
end_process = js.find("function applyAIToLocalMath", start_process)
old_process = js[start_process:end_process]

new_process = """let currentPreviewPayload = null;

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

        """

start_confirm = js.find("function showMultiVoiceConfirm(actions)")
end_confirm = js.find("function closeMultiVoiceConfirm() {", start_confirm)
old_confirm = js[start_confirm:end_confirm]

new_confirm = """function showMultiVoiceConfirm(preview) {
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

        """

if start_process != -1 and start_confirm != -1:
    js = js.replace(old_process, new_process)
    js = js.replace(old_confirm, new_confirm)
    with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Frontend process and confirm logic patched successfully")
else:
    print("Failed to find start indices")

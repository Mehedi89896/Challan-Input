from flask import Flask, request, jsonify, render_template_string
import requests
import re
import time
from datetime import datetime, timedelta, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
app = Flask(__name__)

# --- ULTRA MODERN PRO DARK UI TEMPLATE ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Production Input Portal</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-dark: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --primary: #3b82f6;
            --primary-glow: rgba(59, 130, 246, 0.5);
            --success: #10b981;
            --error: #ef4444;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border: rgba(255, 255, 255, 0.08);
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-dark);
            background-image: 
                radial-gradient(circle at top right, rgba(59, 130, 246, 0.15), transparent 40%),
                radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.1), transparent 40%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
            color: var(--text-main);
        }

        .main-container {
            width: 100%;
            max-width: 400px;
            perspective: 1000px;
        }

        .glass-card {
            background: var(--card-bg);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 2rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
            overflow: hidden;
            transition: transform 0.3s ease;
        }

        .brand-header {
            text-align: center;
            margin-bottom: 2.5rem;
        }

        .brand-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, var(--primary), #2563eb);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            box-shadow: 0 0 20px var(--primary-glow);
            font-size: 1.5rem;
            color: white;
        }

        .brand-title {
            font-size: 1.25rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #fff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .input-wrapper {
            position: relative;
            margin-bottom: 1.5rem;
        }

        .custom-input {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 2px solid var(--border);
            border-radius: 16px;
            padding: 18px;
            font-size: 1.2rem;
            font-weight: 600;
            color: white;
            text-align: center;
            transition: all 0.3s ease;
            outline: none;
        }

        .custom-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
        }

        .custom-input::placeholder {
            color: var(--text-muted);
            font-weight: 400;
            font-size: 1rem;
        }

        .btn-submit {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, var(--primary), #1d4ed8);
            border: none;
            border-radius: 16px;
            color: white;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .btn-submit:active {
            transform: scale(0.98);
        }

        /* Result States */
        .result-state {
            display: none;
            text-align: center;
            animation: fadeIn 0.4s ease;
            background: rgba(15, 23, 42, 0.4);
            padding: 20px;
            border-radius: 16px;
            margin-top: 20px;
            border: 1px solid var(--border);
        }

        .icon-box {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 15px;
            font-size: 1.5rem;
        }

        .success-state .icon-box { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .error-state .icon-box { background: rgba(239, 68, 68, 0.1); color: var(--error); }

        .result-info {
            background: rgba(255,255,255,0.03);
            border-radius: 10px;
            padding: 10px;
            margin: 15px 0;
            font-family: monospace;
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        .action-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 15px;
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 12px;
            border-radius: 12px;
            font-size: 0.85rem;
            text-decoration: none;
            display: flex; flex-direction: column; align-items: center; gap: 5px;
            transition: 0.2s;
        }
        
        .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: var(--text-muted); }
        .btn-outline i { font-size: 1.1rem; color: var(--primary); }

        /* Loader */
        .loader-container {
            position: absolute; inset: 0;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(5px);
            z-index: 10;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 24px;
        }
        
        .spinner {
            width: 40px; height: 40px;
            border: 3px solid rgba(59, 130, 246, 0.3);
            border-radius: 50%;
            border-top-color: var(--primary);
            animation: spin 1s linear infinite;
        }

        .footer-text {
            text-align: center;
            margin-top: 20px;
            color: var(--text-muted);
            font-size: 0.75rem;
            opacity: 0.6;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    </style>
</head>
<body>

    <div class="main-container">
        <div class="glass-card">
            
            <div class="loader-container" id="loader">
                <div class="spinner"></div>
                <div style="margin-top: 15px; font-size: 0.9rem; letter-spacing: 1px;">PROCESSING</div>
            </div>

            <div class="brand-header">
                <div class="brand-icon">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <div class="brand-title">SEWING INPUT PORTAL</div>
                <div style="font-size: 0.8rem; color: var(--primary); margin-top: 5px;">Secure Production System</div>
            </div>

            <form id="mainForm">
                <div class="input-wrapper">
                    <input type="number" inputmode="numeric" id="challanNo" class="custom-input" placeholder="Enter Challan No" required autocomplete="off">
                </div>
                
                <button type="submit" class="btn-submit">
                    SUBMIT DATA <i class="fa-solid fa-arrow-right ms-2"></i>
                </button>
            </form>

            <div id="successBox" class="result-state success-state">
                <div class="icon-box"><i class="fa-solid fa-check"></i></div>
                <h5 style="margin: 0; font-weight: 700;">Input Successful</h5>
                
                <div class="result-info">
                    <div id="successChallan" style="color: #fff; font-weight: bold;">--</div>
                    <div id="sysId" style="font-size: 0.8em;">SYS ID: --</div>
                </div>

                <div class="action-grid">
                    <a href="#" id="link1" target="_blank" class="btn-outline">
                        <i class="fa-solid fa-print"></i> <span>Barcode</span>
                    </a>
                    <a href="#" id="link2" target="_blank" class="btn-outline">
                        <i class="fa-solid fa-file-invoice"></i> <span>Challan</span>
                    </a>
                </div>

                <div style="margin-top: 15px;">
                    <button onclick="resetUI()" class="btn btn-sm btn-dark w-100" style="border: 1px solid var(--border); border-radius: 10px;">
                        Input Another
                    </button>
                </div>
            </div>

            <div id="errorBox" class="result-state error-state">
                <div class="icon-box"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h5 style="color: var(--error);">Input Failed</h5>
                <p class="small text-muted mt-2 mb-3" id="errorMsg">Unknown Error</p>
                <button onclick="resetUI()" class="btn-outline w-100" style="color: #fff; border-color: rgba(255,255,255,0.2);">
                    Try Again
                </button>
            </div>

        </div>
        
        <div class="footer-text">
            &copy; 2025 MnM Software Solutions v2.4
        </div>
    </div>

    <script>
        const form = document.getElementById('mainForm');
        const input = document.getElementById('challanNo');
        const loader = document.getElementById('loader');
        const successBox = document.getElementById('successBox');
        const errorBox = document.getElementById('errorBox');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = input.value;
            if(!val) return;

            // UI Loading State
            input.blur(); // Hide mobile keyboard
            loader.style.display = 'flex';
            successBox.style.display = 'none';
            errorBox.style.display = 'none';

            try {
                const req = await fetch('/process', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({challan: val})
                });
                const res = await req.json();

                loader.style.display = 'none';

                if(res.status === 'success') {
                    document.getElementById('successChallan').innerText = res.challan_no;
                    document.getElementById('sysId').innerText = "SYS ID: " + res.system_id;
                    document.getElementById('link1').href = res.report1_url;
                    document.getElementById('link2').href = res.report2_url;
                    
                    successBox.style.display = 'block';
                } else {
                    document.getElementById('errorMsg').innerText = res.message;
                    errorBox.style.display = 'block';
                }

            } catch (err) {
                loader.style.display = 'none';
                document.getElementById('errorMsg').innerText = "Connection Error. Check Internet.";
                errorBox.style.display = 'block';
            }
        });

        function resetUI() {
            input.value = '';
            successBox.style.display = 'none';
            errorBox.style.display = 'none';
            input.focus();
        }
    </script>
</body>
</html>
"""

# --- BACKEND LOGIC ---
def process_data(user_input):
    base_url = "http://180.92.235.190:8022/erp"
    
    headers_common = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'http://180.92.235.190:8022',
        'Referer': f"{base_url}/login.php"
    }

    session = requests.Session()
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)

    try:
        # 1. Login
        session.post(f"{base_url}/login.php", data={'txt_userid': 'input1.clothing-cutting', 'txt_password': '123456', 'submit': 'Login'}, headers=headers_common)

        # 2. Logic Selection
        cbo_logic = '1'
        if user_input.startswith('4'): cbo_logic = '4'
        elif user_input.startswith('3'): cbo_logic = '2'

        ctrl_url = f"{base_url}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php"
        headers_ajax = headers_common.copy()
        headers_ajax['X-Requested-With'] = 'XMLHttpRequest'
        if 'Content-Type' in headers_ajax: del headers_ajax['Content-Type']

        # 3. Search for System ID
        res = session.get(ctrl_url, params={'data': f"{user_input}_0__{cbo_logic}_2__1_", 'action': 'create_challan_search_list_view'}, headers=headers_ajax)
        mid = re.search(r"js_set_value\((\d+)\)", res.text)
        if not mid: return {"status": "error", "message": "❌ Invalid Challan / No Data Found"}
        sys_id = mid.group(1)

        # 4. Populate Data
        res_pop = session.post(ctrl_url, params={'data': sys_id, 'action': 'populate_data_from_challan_popup'}, data={'rndval': int(time.time()*1000)}, headers=headers_common)
        
        def get_val(pat, txt, d='0'):
            m = re.search(pat, txt)
            return m.group(1) if m else d

        floor = get_val(r"\$\('#cbo_floor'\)\.val\('([^']*)'\)", res_pop.text)
        line = get_val(r"\$\('#cbo_line_no'\)\.val\('([^']*)'\)", res_pop.text)

        # 5. Fetch Bundles
        res_bun = session.get(ctrl_url, params={'data': sys_id, 'action': 'bundle_nos'}, headers=headers_ajax)
        raw_bun = res_bun.text.split("**")[0]
        if not raw_bun: return {"status": "error", "message": "❌ Empty Bundle List"}

        res_tbl = session.get(ctrl_url, params={'data': f"{raw_bun}**0**{sys_id}**{cbo_logic}**{line}", 'action': 'populate_bundle_data_update'}, headers=headers_ajax)
        rows = res_tbl.text.split('<tr')
        b_data = []
        for r in rows:
            if 'id="tr_' not in r: continue
            b_data.append({
                'barcodeNo': get_val(r"title=\"(\d+)\"", r), 'bundleNo': get_val(r"id=\"bundle_\d+\"[^>]*>([^<]+)", r, "Unknown"),
                'orderId': get_val(r"name=\"orderId\[\]\".*?value=\"(\d+)\"", r), 'gmtsitemId': get_val(r"name=\"gmtsitemId\[\]\".*?value=\"(\d+)\"", r),
                'countryId': get_val(r"name=\"countryId\[\]\".*?value=\"(\d+)\"", r), 'colorId': get_val(r"name=\"colorId\[\]\".*?value=\"(\d+)\"", r),
                'sizeId': get_val(r"name=\"sizeId\[\]\".*?value=\"(\d+)\"", r), 'colorSizeId': get_val(r"name=\"colorSizeId\[\]\".*?value=\"(\d+)\"", r),
                'qty': get_val(r"name=\"qty\[\]\".*?value=\"(\d+)\"", r), 'dtlsId': get_val(r"name=\"dtlsId\[\]\".*?value=\"(\d+)\"", r),
                'cutNo': get_val(r"name=\"cutNo\[\]\".*?value=\"([^\"]+)\"", r), 'isRescan': get_val(r"name=\"isRescan\[\]\".*?value=\"(\d+)\"", r)
            })

        # --- TIME FIX (UTC +6 Bangladesh) ---
        # সার্ভার টাইমের বদলে এখন বাংলাদেশ টাইম ব্যবহার হবে
        bd_timezone = timezone(timedelta(hours=6)) 
        now_bd = datetime.now(bd_timezone)
        
        fmt_date = now_bd.strftime("%d-%b-%Y") # e.g. 17-Dec-2025
        curr_time = now_bd.strftime("%H:%M")   # e.g. 14:30 (24H Format)
        # ------------------------------------

        payload = {
            'action': 'save_update_delete', 'operation': '0', 'tot_row': str(len(b_data)),
            'garments_nature': "'2'", 'cbo_company_name': f"'{cbo_logic}'", 'sewing_production_variable': "'3'",
            'cbo_source': "'1'", 'cbo_emb_company': "'2'", 'cbo_location': "'2'", 'cbo_floor': f"'{floor}'",
            'txt_issue_date': f"'{fmt_date}'", 'txt_organic': "''", 'txt_system_id': "''", 'delivery_basis': "'3'",
            'txt_challan_no': "''", 'cbo_line_no': f"'{line}'", 'cbo_shift_name': "'0'",
            'cbo_working_company_name': "'0'", 'cbo_working_location': "'0'", 'txt_remarks': "''", 
            'txt_reporting_hour': f"'{curr_time}'"  # 24H format injected here
        }

        for i, b in enumerate(b_data, 1):
            payload[f'bundleNo_{i}'] = b['bundleNo']; payload[f'orderId_{i}'] = b['orderId']
            payload[f'gmtsitemId_{i}'] = b['gmtsitemId']; payload[f'countryId_{i}'] = b['countryId']
            payload[f'colorId_{i}'] = b['colorId']; payload[f'sizeId_{i}'] = b['sizeId']
            payload[f'inseamId_{i}'] = '0'; payload[f'colorSizeId_{i}'] = b['colorSizeId']
            payload[f'qty_{i}'] = b['qty']; payload[f'dtlsId_{i}'] = b['dtlsId']
            payload[f'cutNo_{i}'] = b['cutNo']; payload[f'isRescan_{i}'] = b['isRescan']
            payload[f'barcodeNo_{i}'] = b['barcodeNo']; payload[f'cutMstIdNo_{i}'] = '0'; payload[f'cutNumPrefixNo_{i}'] = '0'

        headers_save = headers_common.copy()
        headers_save['Referer'] = f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"
        
        save_res = session.post(f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php", data=payload, headers=headers_save)
        
        if "**" in save_res.text:
            parts = save_res.text.split('**')
            code = parts[0].strip()
            
            if code == "0":
                new_sys_id = parts[1]
                new_challan = parts[2] if len(parts) > 2 else "Sewing Challan"
                
                u1 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*{cbo_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined&action=emblishment_issue_print_13"
                u2 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*{cbo_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1&action=sewing_input_challan_print_5"

                return {
                    "status": "success",
                    "challan_no": new_challan,
                    "system_id": new_sys_id,
                    "report1_url": u1,
                    "report2_url": u2
                }
            
            elif code == "20": return {"status": "error", "message": "⚠️ এই বান্ডিলগুলো আগেই ইনপুট নেওয়া হয়েছে!"}
            elif code == "10": return {"status": "error", "message": "❌ Validation Error (Allocation Check)"}
            else: return {"status": "error", "message": f"Server Error Code: {code}"}
        
        return {"status": "error", "message": f"Save Failed: {save_res.status_code}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ROUTES ---
@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    if not data or 'challan' not in data: return jsonify({"status": "error", "message": "No Data"})
    return jsonify(process_data(data['challan']))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000)


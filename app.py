from flask import Flask, request, jsonify, render_template_string
import requests
import re
import time
from datetime import datetime, timedelta, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
app = Flask(__name__)

# --- ORIGINAL CYBER DARK UI (RESTORED & OPTIMIZED) ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sewing Input</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-color: #050505;
            --card-bg: rgba(20, 20, 20, 0.85);
            --primary: #00f260;
            --primary-dark: #0575e6;
            --accent: #00c6ff;
            --text-main: #ffffff;
            --text-muted: #8892b0;
            --border: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
                radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 15px;
        }

        /* Ambient Glow */
        .glow-effect {
            position: absolute;
            width: 300px;
            height: 300px;
            background: linear-gradient(180deg, var(--primary-dark), var(--primary));
            filter: blur(150px);
            opacity: 0.2;
            z-index: -1;
            animation: pulse 10s infinite alternate;
        }

        .main-card {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: 24px;
            width: 100%;
            max-width: 420px;
            padding: 0;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            position: relative;
        }

        .card-header-custom {
            padding: 35px 30px 20px;
            text-align: center;
        }

        .app-title {
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 2.2rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(to right, #fff, #a5b4fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 5px;
        }

        .app-status {
            font-size: 0.8rem;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 1px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        
        .status-dot { width: 8px; height: 8px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 10px var(--primary); }

        .card-body-custom { padding: 30px; }

        .form-control-custom {
            width: 100%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 18px;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-main);
            text-align: center;
            letter-spacing: 3px;
            transition: all 0.3s ease;
            outline: none;
            margin-bottom: 25px;
        }

        .form-control-custom:focus {
            border-color: var(--accent);
            box-shadow: 0 0 20px rgba(0, 198, 255, 0.2);
            background: rgba(255, 255, 255, 0.05);
        }

        .btn-action {
            width: 100%;
            padding: 16px;
            background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%);
            border: none;
            border-radius: 12px;
            color: white;
            font-weight: 600;
            font-size: 1.1rem;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            font-family: 'Rajdhani', sans-serif;
        }

        .btn-action:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0, 114, 255, 0.4);
        }

        /* Result Section */
        .result-box {
            display: none;
            margin-top: 30px;
            padding: 20px;
            border-radius: 16px;
            text-align: center;
            animation: slideUp 0.4s ease;
        }

        .success-box { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); }
        .error-box { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }

        .result-title { font-family: 'Rajdhani', sans-serif; font-weight: 700; margin-bottom: 5px; font-size: 1.4rem; }
        .text-success-custom { color: #34d399; }
        .text-error-custom { color: #f87171; }

        .info-pill {
            background: rgba(255,255,255,0.08);
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 1.1rem;
            color: #fff;
            margin: 15px 0 5px;
            display: inline-block;
            font-family: 'Rajdhani', sans-serif;
            letter-spacing: 1px;
            border: 1px solid rgba(255,255,255,0.1);
        }

        /* Grid Buttons - Side by Side */
        .btn-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 12px; 
            margin-top: 20px; 
        }

        .btn-outline {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.25);
            color: var(--text-main);
            padding: 12px;
            border-radius: 10px;
            font-size: 0.9rem;
            text-decoration: none;
            transition: 0.3s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            font-weight: 500;
        }

        .btn-outline:hover { background: rgba(255,255,255,0.1); border-color: var(--text-main); color: white; }
        
        .loader-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(5, 5, 5, 0.9); backdrop-filter: blur(5px);
            z-index: 100; display: none; flex-direction: column;
            align-items: center; justify-content: center;
        }

        .cyber-spinner {
            width: 50px; height: 50px;
            border: 3px solid transparent;
            border-top: 3px solid var(--accent);
            border-right: 3px solid var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            box-shadow: 0 0 20px rgba(0, 198, 255, 0.5);
        }

        .footer { margin-top: 25px; font-size: 0.75rem; color: rgba(255,255,255,0.3); text-align: center; }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.2; } 100% { transform: scale(1.2); opacity: 0.4; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    </style>
</head>
<body>

    <div class="glow-effect"></div>

    <div class="main-card">
        <div class="loader-overlay" id="loader">
            <div class="cyber-spinner"></div>
            <div style="margin-top: 15px; color: var(--accent); font-family: 'Rajdhani'; letter-spacing: 2px;">PROCESSING...</div>
        </div>

        <div class="card-header-custom">
            <div class="app-title">SEWING<span style="color:var(--accent)">INPUT</span></div>
            <div class="app-status"><div class="status-dot"></div> MNM SYSTEM ACTIVE </div>
        </div>

        <div class="card-body-custom">
            <form id="mainForm">
                <input type="number" inputmode="numeric" id="challanNo" class="form-control-custom" placeholder="ENTER CHALLAN" required autocomplete="off">
                
                <button type="submit" class="btn-action">
                    INPUT SUBMIT <i class="fa-solid fa-bolt ms-2"></i>
                </button>
            </form>

            <div id="successBox" class="result-box success-box">
                <div class="text-success-custom mb-2"><i class="fa-regular fa-circle-check fa-3x"></i></div>
                <div class="result-title text-success-custom">INPUT SUCCESSFUL</div>
                
                <div class="info-pill" id="successChallan">---</div>
                <div class="small text-muted mt-1" id="sysId">---</div>

                <div class="btn-grid">
                    <a href="#" id="link1" target="_blank" class="btn-outline">
                        <i class="fa-solid fa-list"></i> Call List Print
                    </a>
                    <a href="#" id="link2" target="_blank" class="btn-outline">
                        <i class="fa-solid fa-file-invoice"></i> Challan Print
                    </a>
                </div>

                <div class="mt-4">
                    <a href="#" onclick="resetUI()" class="text-muted small text-decoration-none" style="border-bottom: 1px dotted #666;">
                        <i class="fa-solid fa-rotate"></i> Process Another Challan
                    </a>
                </div>
            </div>

            <div id="errorBox" class="result-box error-box">
                <div class="text-error-custom mb-2"><i class="fa-solid fa-triangle-exclamation fa-3x"></i></div>
                <div class="result-title text-error-custom">FAILED</div>
                <p class="small text-white-50 mb-3" id="errorMsg">Unknown Error</p>
                <button onclick="resetUI()" class="btn-outline w-100" style="border-color: #ef4444; color: #ef4444;">TRY AGAIN</button>
            </div>

            <div class="footer">
                < / > MEHEDI HASAN
            </div>
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

            input.blur(); // Close keyboard on mobile
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
                    // Displaying the New Challan No and System ID
                    document.getElementById('successChallan').innerText = res.challan_no;
                    document.getElementById('sysId').innerText = "SYS ID: " + res.system_id;
                    
                    // Setting the links
                    document.getElementById('link1').href = res.report1_url;
                    document.getElementById('link2').href = res.report2_url;
                    
                    successBox.style.display = 'block';
                } else {
                    document.getElementById('errorMsg').innerText = res.message;
                    errorBox.style.display = 'block';
                }

            } catch (err) {
                loader.style.display = 'none';
                document.getElementById('errorMsg').innerText = "Network Error / Server Offline";
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

# --- BACKEND LOGIC (FIXED TIMEZONE + ORIGINAL LOGIC) ---
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

        # 2. Session Activate
        headers_menu = headers_common.copy()
        headers_menu['Referer'] = f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"
        try:
            session.get(f"{base_url}/tools/valid_user_action.php?menuid=724", headers=headers_menu)
            session.get(f"{base_url}/includes/common_functions_for_js.php?data=724_7_406&action=create_menu_session", headers=headers_menu)
        except: pass

        # 3. Logic
        cbo_logic = '1'
        if user_input.startswith('4'): cbo_logic = '4'
        elif user_input.startswith('3'): cbo_logic = '2'

        ctrl_url = f"{base_url}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php"
        headers_ajax = headers_common.copy()
        headers_ajax['X-Requested-With'] = 'XMLHttpRequest'
        if 'Content-Type' in headers_ajax: del headers_ajax['Content-Type']

        # 4. Search
        res = session.get(ctrl_url, params={'data': f"{user_input}_0__{cbo_logic}_2__1_", 'action': 'create_challan_search_list_view'}, headers=headers_ajax)
        mid = re.search(r"js_set_value\((\d+)\)", res.text)
        if not mid: return {"status": "error", "message": "❌ Invalid Challan / No Data"}
        sys_id = mid.group(1)

        res_pop = session.post(ctrl_url, params={'data': sys_id, 'action': 'populate_data_from_challan_popup'}, data={'rndval': int(time.time()*1000)}, headers=headers_common)
        
        def get_val(pat, txt, d='0'):
            m = re.search(pat, txt)
            return m.group(1) if m else d

        floor = get_val(r"\$\('#cbo_floor'\)\.val\('([^']*)'\)", res_pop.text)
        line = get_val(r"\$\('#cbo_line_no'\)\.val\('([^']*)'\)", res_pop.text)

        # Bundles
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

        # 5. Save (With BD TIMEZONE UTC+6)
        # ---------------------------------------------
        bd_zone = timezone(timedelta(hours=6))
        now_bd = datetime.now(bd_zone)
        
        fmt_date = now_bd.strftime("%d-%b-%Y") # e.g., 17-Dec-2025
        curr_time = now_bd.strftime("%H:%M")   # e.g., 14:30 (24H)
        # ---------------------------------------------

        payload = {
            'action': 'save_update_delete', 'operation': '0', 'tot_row': str(len(b_data)),
            'garments_nature': "'2'", 'cbo_company_name': f"'{cbo_logic}'", 'sewing_production_variable': "'3'",
            'cbo_source': "'1'", 'cbo_emb_company': "'2'", 'cbo_location': "'2'", 'cbo_floor': f"'{floor}'",
            'txt_issue_date': f"'{fmt_date}'", 'txt_organic': "''", 'txt_system_id': "''", 'delivery_basis': "'3'",
            'txt_challan_no': "''", 'cbo_line_no': f"'{line}'", 'cbo_shift_name': "'0'",
            'cbo_working_company_name': "'0'", 'cbo_working_location': "'0'", 'txt_remarks': "''", 'txt_reporting_hour': f"'{curr_time}'"
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
                
                # Report Links
                u1 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*{cbo_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined&action=emblishment_issue_print_13"
                u2 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*{cbo_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1&action=sewing_input_challan_print_5"

                return {
                    "status": "success",
                    "challan_no": new_challan,
                    "system_id": new_sys_id,
                    "report1_url": u1,
                    "report2_url": u2
                }
            
            elif code == "20": return {"status": "error", "message": "❌ সার্ভার সমস্যা / বান্ডিল অলরেডি পান্স করা হয়েছে!"}
            elif code == "10": return {"status": "error", "message": "❌ Validation Error (10). Check Allocation."}
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



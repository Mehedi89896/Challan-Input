from flask import Flask, request, jsonify, render_template_string
import requests
import re
import time
from datetime import datetime, timedelta, timezone
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
app = Flask(__name__)

# --- MNM SOFTWARE DESIGN ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Sewing Input Portal</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    
    <style>
        :root {
            --bg-body: #0a0a0f;
            --bg-card: #16161f;
            --text-primary: #FFFFFF;
            --text-secondary: #8b8b9e;
            --accent-orange: #FF7A00;
            --accent-orange-glow: rgba(255, 122, 0, 0.3);
            --accent-green: #10B981;
            --accent-red: #EF4444;
            --border-color: rgba(255, 255, 255, 0.08);
            --gradient-orange: linear-gradient(135deg, #FF7A00 0%, #FF9A40 100%);
            --gradient-card: linear-gradient(145deg, rgba(22, 22, 31, 0.9) 0%, rgba(16, 16, 22, 0.95) 100%);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        body { background: var(--bg-body); color: var(--text-primary); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
        
        .main-container { width: 100%; max-width: 440px; padding: 20px; }
        .glass-card {
            background: var(--gradient-card); border: 1px solid var(--border-color); border-radius: 24px; padding: 40px 35px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.5); position: relative;
        }

        .brand-section { text-align: center; margin-bottom: 35px; }
        .brand-icon {
            width: 70px; height: 70px; background: var(--gradient-orange); border-radius: 18px;
            display: inline-flex; align-items: center; justify-content: center; font-size: 32px; color: white; margin-bottom: 18px;
        }
        .brand-title { font-size: 26px; font-weight: 900; }
        .brand-title span { color: var(--accent-orange); }

        .form-control-custom {
            width: 100%; padding: 18px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);
            border-radius: 16px; color: white; font-size: 18px; text-align: center; outline: none; margin-bottom: 25px;
        }
        .form-control-custom:focus { border-color: var(--accent-orange); }

        .btn-action {
            width: 100%; padding: 16px; background: var(--gradient-orange); color: white; border: none;
            border-radius: 16px; font-weight: 700; font-size: 16px; cursor: pointer;
        }

        .result-box { display: none; margin-top: 30px; }
        .info-card { background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 20px; }
        .status-icon-success { font-size: 40px; color: var(--accent-green); margin-bottom: 15px; }
        
        .error-message {
            background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #F87171;
            padding: 15px; border-radius: 12px; font-size: 14px; text-align: center; margin-bottom: 15px;
        }
        
        .btn-outline {
            background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: #8b8b9e;
            padding: 15px; border-radius: 12px; display: block; text-align: center; text-decoration: none; margin-bottom: 10px;
        }

        #loading-overlay {
            display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(22, 22, 31, 0.9); z-index: 100; flex-direction: column; justify-content: center; align-items: center; border-radius: 24px;
        }
        .spinner {
            width: 50px; height: 50px; border: 4px solid rgba(255, 122, 0, 0.1); border-top: 4px solid var(--accent-orange);
            border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="glass-card">
            <div id="loading-overlay"><div class="spinner"></div></div>
            
            <div class="brand-section">
                <div class="brand-icon"><i class="fa-solid fa-layer-group"></i></div>
                <div class="brand-title">SEWING<span>INPUT</span></div>
            </div>

            <form id="mainForm">
                <input type="number" inputmode="numeric" id="challanNo" class="form-control-custom" placeholder="ENTER CHALLAN NO" required autocomplete="off">
                <button type="submit" class="btn-action">Submit Data</button>
            </form>

            <div id="successBox" class="result-box">
                <div style="text-align: center;"><i class="fa-solid fa-circle-check status-icon-success"></i></div>
                <div class="info-card">
                    <div style="font-size: 22px; font-weight: 800; color: white;" id="successChallan">---</div>
                    <div style="font-size: 13px; color: #8b8b9e;" id="sysId">---</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <a href="#" id="link1" target="_blank" class="btn-outline">Print 1</a>
                    <a href="#" id="link2" target="_blank" class="btn-outline">Print 2</a>
                </div>
                <a href="#" onclick="location.reload()" class="btn-outline" style="margin-top: 15px;">Input Another</a>
            </div>

            <div id="errorBox" class="result-box">
                <div class="error-message"><i class="fa-solid fa-triangle-exclamation"></i> <span id="errorMsg">Error</span></div>
                <button onclick="location.reload()" class="btn-outline" style="width:100%; color: #EF4444;">Try Again</button>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('mainForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = document.getElementById('challanNo').value;
            if(!val) return;
            
            document.getElementById('loading-overlay').style.display = 'flex';
            document.getElementById('successBox').style.display = 'none';
            document.getElementById('errorBox').style.display = 'none';

            try {
                const req = await fetch('/process', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({challan: val})
                });
                const res = await req.json();
                document.getElementById('loading-overlay').style.display = 'none';

                if(res.status === 'success') {
                    document.getElementById('successChallan').innerText = res.challan_no;
                    document.getElementById('sysId').innerText = "SYS ID: " + res.system_id;
                    document.getElementById('link1').href = res.report1_url;
                    document.getElementById('link2').href = res.report2_url;
                    document.getElementById('successBox').style.display = 'block';
                } else {
                    document.getElementById('errorMsg').innerText = res.message;
                    document.getElementById('errorBox').style.display = 'block';
                }
            } catch (err) {
                document.getElementById('loading-overlay').style.display = 'none';
                document.getElementById('errorMsg').innerText = "Network Error";
                document.getElementById('errorBox').style.display = 'block';
            }
        });
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

        # 2. Session Activate
        headers_menu = headers_common.copy()
        headers_menu['Referer'] = f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"
        try:
            session.get(f"{base_url}/tools/valid_user_action.php?menuid=724", headers=headers_menu)
            session.get(f"{base_url}/includes/common_functions_for_js.php?data=724_7_406&action=create_menu_session", headers=headers_menu)
        except: pass

        # 3. Logic setup
        cbo_logic = '1'
        if user_input.startswith('4'): cbo_logic = '4'
        elif user_input.startswith('3'): cbo_logic = '2'

        ctrl_url = f"{base_url}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php"
        headers_ajax = headers_common.copy()
        headers_ajax['X-Requested-With'] = 'XMLHttpRequest'
        if 'Content-Type' in headers_ajax: del headers_ajax['Content-Type']

        # 4. Search and Get Popup Data
        res = session.get(ctrl_url, params={'data': f"{user_input}_0__{cbo_logic}_2__1_", 'action': 'create_challan_search_list_view'}, headers=headers_ajax)
        mid = re.search(r"js_set_value\((\d+)\)", res.text)
        if not mid: return {"status": "error", "message": "❌ Invalid Challan / No Data"}
        sys_id = mid.group(1)

        res_pop = session.post(ctrl_url, params={'data': sys_id, 'action': 'populate_data_from_challan_popup'}, data={'rndval': int(time.time()*1000)}, headers=headers_common)
        
        # 🟢 STRICT HELPER FUNCTION
        # If value is NOT found, it returns '0'.
        # If value IS found but contains spaces (e.g. " 0 "), it strips it to "0".
        def get_val(pat, txt):
            m = re.search(pat, txt)
            if m:
                val = m.group(1).strip() # Remove spaces
                return val if val else '0' # Return '0' if empty string
            return '0' # Return '0' if pattern matches nothing

        # =========================================================================
        # 🔥 EXTRACTING & VALIDATING DATA (STRICT MODE) 🔥
        # =========================================================================
        
        # Regex to capture value inside .val('...')
        source = get_val(r"\$\('#cbo_source'\)\.val\('([^']*)'\)", res_pop.text)
        emb_company = get_val(r"\$\('#cbo_emb_company'\)\.val\('([^']*)'\)", res_pop.text)
        line = get_val(r"\$\('#cbo_line_no'\)\.val\('([^']*)'\)", res_pop.text)
        location = get_val(r"\$\('#cbo_location'\)\.val\('([^']*)'\)", res_pop.text)
        floor = get_val(r"\$\('#cbo_floor'\)\.val\('([^']*)'\)", res_pop.text) # Getting floor too as it is needed

        # LIST OF FORBIDDEN VALUES
        # If any variable matches these, WE STOP.
        forbidden = ['0', '00', '', 'undefined', 'null']

        missing_fields = []
        if source in forbidden: missing_fields.append("Source")
        if emb_company in forbidden: missing_fields.append("Emb Company")
        if line in forbidden: missing_fields.append("Line No")
        if location in forbidden: missing_fields.append("Location")
        
        # Checking Floor as well since it's in your payload, though you asked for 4 specific ones.
        # It is safer to check floor too.
        if floor in forbidden: missing_fields.append("Floor")

        if missing_fields:
            return {
                "status": "error", 
                "message": f"⚠️ Missing/Zero Value: {', '.join(missing_fields)}"
            }
        # =========================================================================

        # Bundles Extraction
        res_bun = session.get(ctrl_url, params={'data': sys_id, 'action': 'bundle_nos'}, headers=headers_ajax)
        raw_bun = res_bun.text.split("**")[0]
        if not raw_bun: return {"status": "error", "message": "❌ Empty Bundle List"}

        res_tbl = session.get(ctrl_url, params={'data': f"{raw_bun}**0**{sys_id}**{cbo_logic}**{line}", 'action': 'populate_bundle_data_update'}, headers=headers_ajax)
        rows = res_tbl.text.split('<tr')
        b_data = []
        for r in rows:
            if 'id="tr_' not in r: continue
            def get_row_val(pat, txt):
                m = re.search(pat, txt)
                return m.group(1) if m else '0'
            
            b_data.append({
                'barcodeNo': get_row_val(r"title=\"(\d+)\"", r), 
                'bundleNo': get_row_val(r"id=\"bundle_\d+\"[^>]*>([^<]+)", r),
                'orderId': get_row_val(r"name=\"orderId\[\]\".*?value=\"(\d+)\"", r), 
                'gmtsitemId': get_row_val(r"name=\"gmtsitemId\[\]\".*?value=\"(\d+)\"", r),
                'countryId': get_row_val(r"name=\"countryId\[\]\".*?value=\"(\d+)\"", r), 
                'colorId': get_row_val(r"name=\"colorId\[\]\".*?value=\"(\d+)\"", r),
                'sizeId': get_row_val(r"name=\"sizeId\[\]\".*?value=\"(\d+)\"", r), 
                'colorSizeId': get_row_val(r"name=\"colorSizeId\[\]\".*?value=\"(\d+)\"", r),
                'qty': get_row_val(r"name=\"qty\[\]\".*?value=\"(\d+)\"", r), 
                'dtlsId': get_row_val(r"name=\"dtlsId\[\]\".*?value=\"(\d+)\"", r),
                'cutNo': get_row_val(r"name=\"cutNo\[\]\".*?value=\"([^\"]+)\"", r), 
                'isRescan': get_row_val(r"name=\"isRescan\[\]\".*?value=\"(\d+)\"", r)
            })

        # 5. Save Payload Construction (Using Validated Data)
        bd_zone = timezone(timedelta(hours=6))
        now_bd = datetime.now(bd_zone)
        fmt_date = now_bd.strftime("%d-%b-%Y")
        
        # NOTE: Your sample payload uses '0' for working company/location, so we keep those hardcoded as '0'.
        # But we use the VALIDATED variables for the strict fields.
        payload = {
            'action': 'save_update_delete', 
            'operation': '0', 
            'tot_row': str(len(b_data)),
            'garments_nature': "'2'", 
            'cbo_company_name': f"'{cbo_logic}'", 
            'sewing_production_variable': "'3'",
            'cbo_source': f"'{source}'",          # Validated
            'cbo_emb_company': f"'{emb_company}'", # Validated
            'cbo_location': f"'{location}'",      # Validated
            'cbo_floor': f"'{floor}'",            # Validated
            'txt_issue_date': f"'{fmt_date}'", 
            'txt_organic': "''", 
            'txt_system_id': "''", 
            'delivery_basis': "'3'",
            'txt_challan_no': "''", 
            'cbo_line_no': f"'{line}'",           # Validated
            'cbo_shift_name': "'0'",
            'cbo_working_company_name': "'0'", 
            'cbo_working_location': "'0'", 
            'txt_remarks': "''", 
            'txt_reporting_hour': "''" # Removed explicit hour to match your sample closer, or keep empty
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
                u1 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*3*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined&action=emblishment_issue_print_13"
                u2 = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php?data=1*{new_sys_id}*3*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1&action=sewing_input_challan_print_5"
                return {"status": "success", "challan_no": new_challan, "system_id": new_sys_id, "report1_url": u1, "report2_url": u2}
            elif code == "20": return {"status": "error", "message": "❌ Bundle Already Scanned!"}
            elif code == "10": return {"status": "error", "message": "❌ Validation Error (10)."}
            else: return {"status": "error", "message": f"Server Error Code: {code}"}
        
        return {"status": "error", "message": f"Save Failed: {save_res.status_code}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ROUTES ---
@app.route('/')
def index(): return render_template_string(HTML_TEMPLATE)

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    if not data or 'challan' not in data: return jsonify({"status": "error", "message": "No Data"})
    return jsonify(process_data(data['challan']))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000)


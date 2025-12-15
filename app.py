from flask import Flask, request, jsonify, render_template_string, send_from_directory
import requests
import re
import time
import os
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
app = Flask(__name__)
REPORT_DIR = "reports"  # রিপোর্ট সেভ করার ফোল্ডার
if not os.path.exists(REPORT_DIR):
    os.makedirs(REPORT_DIR)

# --- FRONTEND TEMPLATE (HTML + CSS + JS) ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Professional Challan Entry</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .card-custom {
            border: none;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            background: white;
            overflow: hidden;
            width: 100%;
            max-width: 450px;
        }
        .card-header-custom {
            background: linear-gradient(45deg, #0d6efd, #0043a8);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .form-control-lg {
            border-radius: 10px;
            padding: 15px;
            font-size: 1.1rem;
            border: 2px solid #eef2f7;
            background-color: #f9fbff;
            text-align: center;
            letter-spacing: 2px;
            font-weight: bold;
        }
        .form-control-lg:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.15);
        }
        .btn-process {
            border-radius: 10px;
            padding: 12px;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.3s ease;
        }
        .btn-process:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(13, 110, 253, 0.3);
        }
        .result-box {
            display: none;
            margin-top: 20px;
            animation: fadeIn 0.5s ease-in-out;
        }
        .success-card {
            background-color: #ecfdf5;
            border: 1px solid #10b981;
            padding: 20px;
            text-align: center;
            border-radius: 15px;
        }
        .error-card {
            background-color: #fef2f2;
            border: 1px solid #ef4444;
            padding: 20px;
            text-align: center;
            border-radius: 15px;
        }
        .challan-display {
            font-size: 1.4rem;
            font-weight: bold;
            color: #047857;
            margin: 15px 0;
            padding: 10px;
            background: white;
            border-radius: 8px;
            border: 1px dashed #10b981;
        }
        .report-btn {
            width: 100%;
            margin-top: 10px;
            padding: 12px;
            border-radius: 10px;
            font-weight: 500;
        }
        .loader { display: none; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .footer-text {
            font-size: 0.75rem;
            color: #aaa;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card card-custom mx-auto">
            <div class="card-header-custom">
                <h3><i class="fa-solid fa-industry me-2"></i>Sewing Input</h3>
                <p class="mb-0 opacity-75">Automation System v3.0</p>
            </div>
            
            <div class="card-body p-4">
                <form id="challanForm">
                    <div class="mb-4">
                        <label class="form-label text-muted fw-bold small text-uppercase">Scan / Enter Challan No</label>
                        <div class="input-group">
                            <input type="number" class="form-control form-control-lg" id="challanInput" placeholder="xxxxxx" required autofocus autocomplete="off">
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary w-100 btn-process" id="submitBtn">
                        <span class="normal-text">PROCEED <i class="fa-solid fa-bolt ms-2"></i></span>
                        <span class="loader">
                            <span class="spinner-border spinner-border-sm me-2"></span> Processing...
                        </span>
                    </button>
                </form>

                <div id="successBox" class="result-box">
                    <div class="success-card">
                        <div class="mb-2"><i class="fa-solid fa-circle-check fa-3x text-success"></i></div>
                        <h5 class="text-success fw-bold">SUCCESS!</h5>
                        
                        <div class="challan-display" id="displayChallanNo">
                            LOADING...
                        </div>
                        <small class="text-muted d-block mb-3" id="systemIdDisplay">ID: ---</small>

                        <div class="row g-2">
                            <div class="col-6">
                                <a href="#" id="btnReport1" target="_blank" class="btn btn-outline-primary report-btn">
                                    <i class="fa-solid fa-list-ol me-1"></i> Details
                                </a>
                            </div>
                            <div class="col-6">
                                <a href="#" id="btnReport2" target="_blank" class="btn btn-dark report-btn">
                                    <i class="fa-solid fa-print me-1"></i> Print
                                </a>
                            </div>
                        </div>
                        <button class="btn btn-link text-decoration-none mt-3 text-muted" onclick="resetForm()">
                            <i class="fa-solid fa-rotate-right me-1"></i> Next Challan
                        </button>
                    </div>
                </div>

                <div id="errorBox" class="result-box">
                    <div class="error-card">
                        <div class="mb-2"><i class="fa-solid fa-circle-exclamation fa-3x text-danger"></i></div>
                        <h5 class="text-danger fw-bold">FAILED</h5>
                        <p id="errorMessage" class="text-dark mb-0 fw-bold small">Error details here.</p>
                        <button class="btn btn-danger btn-sm mt-3 px-4 rounded-pill" onclick="resetForm()">Try Again</button>
                    </div>
                </div>

                <div class="footer-text">
                    &copy; 2025 MnM Office | Secure Connection
                </div>
            </div>
        </div>
    </div>

    <script>
        const form = document.getElementById('challanForm');
        const submitBtn = document.getElementById('submitBtn');
        const normalText = document.querySelector('.normal-text');
        const loader = document.querySelector('.loader');
        const successBox = document.getElementById('successBox');
        const errorBox = document.getElementById('errorBox');
        const inputField = document.getElementById('challanInput');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const challanNo = inputField.value;

            // UI State: Loading
            inputField.disabled = true;
            submitBtn.disabled = true;
            normalText.style.display = 'none';
            loader.style.display = 'inline-block';
            successBox.style.display = 'none';
            errorBox.style.display = 'none';

            try {
                const response = await fetch('/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ challan: challanNo })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // Show Success
                    document.getElementById('displayChallanNo').innerText = data.challan_no;
                    document.getElementById('systemIdDisplay').innerText = "Sys ID: " + data.system_id;
                    document.getElementById('btnReport1').href = `/reports/${data.report1}`;
                    document.getElementById('btnReport2').href = `/reports/${data.report2}`;
                    successBox.style.display = 'block';
                } else {
                    // Show Error
                    document.getElementById('errorMessage').innerText = data.message;
                    errorBox.style.display = 'block';
                }

            } catch (error) {
                document.getElementById('errorMessage').innerText = "Network/Server Error. Please refresh.";
                errorBox.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                normalText.style.display = 'inline-block';
                loader.style.display = 'none';
            }
        });

        function resetForm() {
            inputField.disabled = false;
            inputField.value = '';
            successBox.style.display = 'none';
            errorBox.style.display = 'none';
            setTimeout(() => inputField.focus(), 100);
        }
    </script>
</body>
</html>
"""

# --- BACKEND LOGIC ---
def process_challan_logic(user_input):
    base_url = "http://180.92.235.190:8022/erp"
    
    headers_common = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'http://180.92.235.190:8022',
        'Referer': f"{base_url}/login.php"
    }

    session = requests.Session()
    
    # Auto-Retry Strategy
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["HEAD", "GET", "POST"])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    # 1. LOGIN
    try:
        session.post(f"{base_url}/login.php", data={'txt_userid': 'input1.clothing-cutting', 'txt_password': '123456', 'submit': 'Login'}, headers=headers_common)
    except Exception as e:
        return {"status": "error", "message": f"Login Failed: {str(e)}"}

    # 2. ACTIVATE MENU SESSION
    headers_menu = headers_common.copy()
    headers_menu['Referer'] = f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"
    try:
        session.get(f"{base_url}/tools/valid_user_action.php?menuid=724", headers=headers_menu)
        session.get(f"{base_url}/includes/common_functions_for_js.php?data=724_7_406&action=create_menu_session", headers=headers_menu)
    except:
        pass

    # Logic
    first_digit = user_input[0]
    cbo_company_logic = '1'
    if first_digit == '4': cbo_company_logic = '4'
    elif first_digit == '3': cbo_company_logic = '2'

    # 3. FETCH DATA
    controller_url = f"{base_url}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php"
    headers_ajax = headers_common.copy()
    headers_ajax['X-Requested-With'] = 'XMLHttpRequest'
    if 'Content-Type' in headers_ajax: del headers_ajax['Content-Type']

    try:
        # Search
        res_search = session.get(controller_url, params={'data': f"{user_input}_0__{cbo_company_logic}_2__1_", 'action': 'create_challan_search_list_view'}, headers=headers_ajax)
        match_id = re.search(r"js_set_value\((\d+)\)", res_search.text)
        if not match_id:
            return {"status": "error", "message": "❌ চালান খুঁজে পাওয়া যায়নি (Invalid Challan)"}
        cutting_system_id = match_id.group(1)

        # Header Info
        res_pop = session.post(controller_url, params={'data': cutting_system_id, 'action': 'populate_data_from_challan_popup'}, data={'rndval': int(time.time() * 1000)}, headers=headers_common)
        
        def get_val(pattern, text, default='0'):
            m = re.search(pattern, text)
            return m.group(1) if m else default

        extracted_floor = get_val(r"\$\('#cbo_floor'\)\.val\('([^']*)'\)", res_pop.text)
        extracted_line = get_val(r"\$\('#cbo_line_no'\)\.val\('([^']*)'\)", res_pop.text)
        
        # Date Logic (Extraction)
        raw_date = get_val(r"\$\('#txt_issue_date'\)\.val\('([^']*)'\)", res_pop.text, datetime.now().strftime("%d-%b-%Y"))
        try:
            formatted_issue_date = datetime.strptime(raw_date, "%d-%m-%Y").strftime("%d-%b-%Y")
        except:
            formatted_issue_date = raw_date

        # Bundles
        res_bundle = session.get(controller_url, params={'data': cutting_system_id, 'action': 'bundle_nos'}, headers=headers_ajax)
        raw_bundles = res_bundle.text.split("**")[0]
        if not raw_bundles:
            return {"status": "error", "message": "❌ বান্ডিল পাওয়া যায়নি (No Bundles)"}

        res_table = session.get(controller_url, params={'data': f"{raw_bundles}**0**{cutting_system_id}**{cbo_company_logic}**{extracted_line}", 'action': 'populate_bundle_data_update'}, headers=headers_ajax)
        
        rows = res_table.text.split('<tr')
        bundle_rows_data = []
        for row in rows:
            if 'id="tr_' not in row: continue
            row_data = {
                'barcodeNo': get_val(r"title=\"(\d+)\"", row), 'bundleNo': get_val(r"id=\"bundle_\d+\"[^>]*>([^<]+)", row, "Unknown"),
                'orderId': get_val(r"name=\"orderId\[\]\".*?value=\"(\d+)\"", row), 'gmtsitemId': get_val(r"name=\"gmtsitemId\[\]\".*?value=\"(\d+)\"", row),
                'countryId': get_val(r"name=\"countryId\[\]\".*?value=\"(\d+)\"", row), 'colorId': get_val(r"name=\"colorId\[\]\".*?value=\"(\d+)\"", row),
                'sizeId': get_val(r"name=\"sizeId\[\]\".*?value=\"(\d+)\"", row), 'colorSizeId': get_val(r"name=\"colorSizeId\[\]\".*?value=\"(\d+)\"", row),
                'qty': get_val(r"name=\"qty\[\]\".*?value=\"(\d+)\"", row), 'dtlsId': get_val(r"name=\"dtlsId\[\]\".*?value=\"(\d+)\"", row),
                'cutNo': get_val(r"name=\"cutNo\[\]\".*?value=\"([^\"]+)\"", row), 'isRescan': get_val(r"name=\"isRescan\[\]\".*?value=\"(\d+)\"", row)
            }
            bundle_rows_data.append(row_data)

        # 5. SAVE REQUEST
        current_time = datetime.now().strftime("%H:%M")
        
        # MASTER DATA WITH QUOTES
        final_payload = {
            'action': 'save_update_delete', 'operation': '0', 'tot_row': str(len(bundle_rows_data)),
            'garments_nature': "'2'", 'cbo_company_name': f"'{cbo_company_logic}'", 'sewing_production_variable': "'3'",
            'cbo_source': "'1'", 'cbo_emb_company': "'2'", 'cbo_location': "'2'", 'cbo_floor': f"'{extracted_floor}'",
            'txt_issue_date': f"'{formatted_issue_date}'", 'txt_organic': "''", 'txt_system_id': "''", 'delivery_basis': "'3'",
            'txt_challan_no': "''", 'cbo_line_no': f"'{extracted_line}'", 'cbo_shift_name': "'0'",
            'cbo_working_company_name': "'0'", 'cbo_working_location': "'0'", 'txt_remarks': "''", 'txt_reporting_hour': f"'{current_time}'"
        }

        # BUNDLE DATA WITHOUT QUOTES
        for i, b in enumerate(bundle_rows_data, 1):
            final_payload[f'bundleNo_{i}'] = b['bundleNo']; final_payload[f'orderId_{i}'] = b['orderId']
            final_payload[f'gmtsitemId_{i}'] = b['gmtsitemId']; final_payload[f'countryId_{i}'] = b['countryId']
            final_payload[f'colorId_{i}'] = b['colorId']; final_payload[f'sizeId_{i}'] = b['sizeId']
            final_payload[f'inseamId_{i}'] = '0'; final_payload[f'colorSizeId_{i}'] = b['colorSizeId']
            final_payload[f'qty_{i}'] = b['qty']; final_payload[f'dtlsId_{i}'] = b['dtlsId']
            final_payload[f'cutNo_{i}'] = b['cutNo']; final_payload[f'isRescan_{i}'] = b['isRescan']
            final_payload[f'barcodeNo_{i}'] = b['barcodeNo']; final_payload[f'cutMstIdNo_{i}'] = '0'; final_payload[f'cutNumPrefixNo_{i}'] = '0'

        save_response = session.post(f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php", data=final_payload, headers={'Referer': f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"})
        
        resp_text = save_response.text
        if "**" in resp_text:
            parts = resp_text.split('**')
            code = parts[0].strip()
            
            if code == "0":
                new_system_id = parts[1]
                new_challan_no = parts[2] if len(parts) > 2 else "Sewing Challan"
                
                # --- DOWNLOAD REPORTS ---
                report_headers = headers_common.copy()
                report_headers['Upgrade-Insecure-Requests'] = '1'
                
                # Report 1
                data_1 = f"1*{new_system_id}*{cbo_company_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined"
                res_rep1 = session.get(controller_url, params={'data': data_1, 'action': 'emblishment_issue_print_13'}, headers=report_headers)
                file_1_name = f"Bundle_{new_system_id}.html"
                with open(os.path.join(REPORT_DIR, file_1_name), "w", encoding="utf-8") as f: f.write(res_rep1.text)
                
                # Report 2
                data_2 = f"1*{new_system_id}*{cbo_company_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1"
                res_rep2 = session.get(controller_url, params={'data': data_2, 'action': 'sewing_input_challan_print_5'}, headers=report_headers)
                file_2_name = f"Challan_{new_system_id}.html"
                with open(os.path.join(REPORT_DIR, file_2_name), "w", encoding="utf-8") as f: f.write(res_rep2.text)

                return {
                    "status": "success",
                    "challan_no": new_challan_no,
                    "system_id": new_system_id,
                    "report1": file_1_name,
                    "report2": file_2_name
                }

            elif code == "20":
                return {"status": "error", "message": "❌ সার্ভার সমস্যা / বান্ডিল অলরেডি পান্স করা হয়েছে!"}
            elif code == "10":
                return {"status": "error", "message": "❌ Validation Failed (10). Check Line/Floor."}
            else:
                return {"status": "error", "message": f"Server Error Code: {code}"}
        else:
            return {"status": "error", "message": f"Failed Status: {save_response.status_code}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ROUTES ---
@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/process', methods=['POST'])
def process():
    data = request.json
    challan = data.get('challan')
    if not challan:
        return jsonify({"status": "error", "message": "No Challan Entered"})
    
    result = process_challan_logic(challan)
    return jsonify(result)

@app.route('/reports/<filename>')
def download_report(filename):
    return send_from_directory(REPORT_DIR, filename)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=10000)


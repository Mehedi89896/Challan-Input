# ফাইল নাম: app.py

import requests
import re
import time
import os
import webbrowser
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def main_process():
    print("--- System Starting (Final Robust Version) ---")
    
    base_url = "http://180.92.235.190:8022/erp"
    
    headers_common = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'http://180.92.235.190:8022',
        'Referer': f"{base_url}/login.php"
    }

    # ==========================================
    # FIX: CONNECTION AUTO-RETRY STRATEGY
    # ==========================================
    session = requests.Session()
    
    # সার্ভার কানেকশন ড্রপ করলে ৩ বার পর্যন্ত অটোমেটিক চেষ্টা করবে
    retry_strategy = Retry(
        total=3,
        backoff_factor=1, 
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "POST"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    # 1. LOGIN
    print("\n1. Logging in...")
    login_data = {'txt_userid': 'input1.clothing-cutting', 'txt_password': '123456', 'submit': 'Login'}
    try:
        session.post(f"{base_url}/login.php", data=login_data, headers=headers_common)
        print("✅ Login Successful!")
    except Exception as e:
        print(f"❌ Login Error: {e}")
        return

    # 2. ACTIVATE SESSION (To prevent Error 10)
    print("\n2. Activating Session...")
    headers_menu = headers_common.copy()
    headers_menu['Referer'] = f"{base_url}/production/bundle_wise_sewing_input.php?permission=1_1_2_1"
    try:
        session.get(f"{base_url}/tools/valid_user_action.php?menuid=724", headers=headers_menu)
        session.get(f"{base_url}/includes/common_functions_for_js.php?data=724_7_406&action=create_menu_session", headers=headers_menu)
        print("✅ Session Activated.")
    except:
        pass

    # 3. INPUT
    print("\n--------------------------------")
    user_input = input("Please enter Challan Number: ")
    if not user_input: return

    first_digit = user_input[0]
    cbo_company_logic = '1'
    if first_digit == '4': cbo_company_logic = '4'
    elif first_digit == '3': cbo_company_logic = '2'

    # 4. FETCH DATA
    print("\n3. Processing Data...")
    controller_url = f"{base_url}/production/requires/bundle_wise_cutting_delevar_to_input_controller.php"
    headers_ajax = headers_common.copy()
    headers_ajax['X-Requested-With'] = 'XMLHttpRequest'
    if 'Content-Type' in headers_ajax: del headers_ajax['Content-Type']

    try:
        # Search
        res_search = session.get(controller_url, params={'data': f"{user_input}_0__{cbo_company_logic}_2__1_", 'action': 'create_challan_search_list_view'}, headers=headers_ajax)
        match_id = re.search(r"js_set_value\((\d+)\)", res_search.text)
        if not match_id:
            print("❌ System ID missing.")
            return
        cutting_system_id = match_id.group(1)

        # Header Extraction
        res_pop = session.post(controller_url, params={'data': cutting_system_id, 'action': 'populate_data_from_challan_popup'}, data={'rndval': int(time.time() * 1000)}, headers=headers_common)
        
        def get_val(pattern, text, default='0'):
            m = re.search(pattern, text)
            return m.group(1) if m else default

        extracted_floor = get_val(r"\$\('#cbo_floor'\)\.val\('([^']*)'\)", res_pop.text)
        extracted_line = get_val(r"\$\('#cbo_line_no'\)\.val\('([^']*)'\)", res_pop.text)
        
        # --- DATE FIX (To prevent Error 20) ---
        # কাটিং এর তারিখটিই নেওয়া হচ্ছে এবং ফরম্যাট ঠিক করা হচ্ছে
        raw_date = get_val(r"\$\('#txt_issue_date'\)\.val\('([^']*)'\)", res_pop.text, datetime.now().strftime("%d-%b-%Y"))
        try:
            formatted_issue_date = datetime.strptime(raw_date, "%d-%m-%Y").strftime("%d-%b-%Y")
        except:
            formatted_issue_date = raw_date
            
        print(f"✅ Extracted -> Floor: {extracted_floor} | Line: {extracted_line} | Date: {formatted_issue_date}")

        # Bundles
        res_bundle = session.get(controller_url, params={'data': cutting_system_id, 'action': 'bundle_nos'}, headers=headers_ajax)
        raw_bundles = res_bundle.text.split("**")[0]
        if not raw_bundles:
            print("❌ No bundles found.")
            return

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
        print(f"✅ Ready to save {len(bundle_rows_data)} bundles...")
        current_time = datetime.now().strftime("%H:%M")

        final_payload = {
            'action': 'save_update_delete', 'operation': '0', 'tot_row': str(len(bundle_rows_data)),
            'garments_nature': "'2'", 'cbo_company_name': f"'{cbo_company_logic}'", 'sewing_production_variable': "'3'",
            'cbo_source': "'1'", 'cbo_emb_company': "'2'", 'cbo_location': "'2'", 'cbo_floor': f"'{extracted_floor}'",
            
            'txt_issue_date': f"'{formatted_issue_date}'", # Extracted Date
            
            'txt_organic': "''", 'txt_system_id': "''", 'delivery_basis': "'3'",
            'txt_challan_no': "''", 'cbo_line_no': f"'{extracted_line}'", 'cbo_shift_name': "'0'",
            'cbo_working_company_name': "'0'", 'cbo_working_location': "'0'", 'txt_remarks': "''", 'txt_reporting_hour': f"'{current_time}'"
        }

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
                new_challan_no = parts[2] if len(parts) > 2 else "Unknown"
                
                print(f"\n🎉 SUCCESS: Data Saved!")
                print(f"🔑 System ID: {new_system_id}")
                print(f"📦 Challan No: {new_challan_no}")
                
                # ==========================================
                # 6. DOWNLOAD REPORTS (2 FILES)
                # ==========================================
                print("\n📥 Downloading Reports...")
                
                report_controller = f"{base_url}/production/requires/bundle_wise_sewing_input_controller.php"
                report_headers = headers_common.copy()
                report_headers['Upgrade-Insecure-Requests'] = '1'
                
                # Report 1
                data_1 = f"1*{new_system_id}*{cbo_company_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*1*undefined*undefined*undefined"
                res_rep1 = session.get(report_controller, params={'data': data_1, 'action': 'emblishment_issue_print_13'}, headers=report_headers)
                file_1 = f"1_BundleReport_{new_challan_no}.html"
                with open(file_1, "w", encoding="utf-8") as f: f.write(res_rep1.text)
                
                # Report 2
                data_2 = f"1*{new_system_id}*{cbo_company_logic}*%E2%9D%8F%20Bundle%20Wise%20Sewing%20Input*undefined*undefined*undefined*1"
                res_rep2 = session.get(report_controller, params={'data': data_2, 'action': 'sewing_input_challan_print_5'}, headers=report_headers)
                file_2 = f"2_ChallanReport_{new_challan_no}.html"
                with open(file_2, "w", encoding="utf-8") as f: f.write(res_rep2.text)
                
                print(f"✅ Saved Files:\n  - {file_1}\n  - {file_2}")

                # Open
                print("🚀 Opening Reports...")
                try:
                    webbrowser.open(f"file://{os.path.abspath(file_1)}")
                    time.sleep(1)
                    webbrowser.open(f"file://{os.path.abspath(file_2)}")
                except:
                    print("⚠️ Auto-open failed.")

            # --- CUSTOM ERROR MESSAGES ---
            elif code == "20":
                print("\n❌ সার্ভার সমস্যা/বান্ডিল অলরেডি পান্স করা হয়েছে")
            elif code == "10":
                print("\n❌ Error 10: Validation Failed (Check Line/Floor Allocation).")
            else:
                print(f"\nℹ️ Server Code: {code}")
        else:
            print(f"❌ Failed: {save_response.status_code}")

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        time.sleep(2)

if __name__ == "__main__":
    main_process()

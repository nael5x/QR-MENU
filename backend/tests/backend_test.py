"""Backend regression tests for QR Menu SaaS.

Covers: auth (register/login/me), dashboard, restaurant update, branches CRUD,
tables (with QR), categories, items (+availability/visibility toggles),
staff management (admin-only), public menu, change logs, and multi-tenant
isolation.
"""

import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ["EXPO_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/") + "/api"

ADMIN_EMAIL = "admin@demo.com"
ADMIN_PW = "demo1234"
STAFF_EMAIL = "staff@demo.com"
STAFF_PW = "demo1234"
DEMO_QR = "demo-table-1"


def _auth(headers_token):
    return {"Authorization": f"Bearer {headers_token}"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def staff_token():
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PW}, timeout=30)
    assert r.status_code == 200, f"staff login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin_returns_user_and_restaurant(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        assert data["restaurant"]["name"]

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_token):
        r = requests.get(f"{BASE_URL}/auth/me", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/auth/me")
        assert r.status_code == 401

    def test_register_creates_new_tenant(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@demo.com"
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "restaurant_name": "TEST Restaurant",
            "email": email,
            "password": "pass1234",
            "languages": ["ar", "en"],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert d["restaurant"]["name"] == "TEST Restaurant"

    def test_register_duplicate_email(self):
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "restaurant_name": "Dup",
            "email": ADMIN_EMAIL,
            "password": "pass1234",
        })
        assert r.status_code == 409


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_counts(self, admin_token):
        r = requests.get(f"{BASE_URL}/dashboard", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("branches", "tables", "categories", "items", "unavailable_items", "orders_enabled"):
            assert k in d
        assert isinstance(d["branches"], int)


# ---------------- Restaurant update ----------------
class TestRestaurantUpdate:
    def test_toggle_orders_enabled_admin(self, admin_token):
        r = requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": False}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["orders_enabled"] is False
        # revert
        r2 = requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": True}, headers=_auth(admin_token))
        assert r2.status_code == 200
        assert r2.json()["orders_enabled"] is True

    def test_staff_cannot_update_restaurant(self, staff_token):
        r = requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": False}, headers=_auth(staff_token))
        assert r.status_code == 403


# ---------------- Branches / tables / categories / items full flow ----------------
class TestBranchTableCategoryItem:
    created = {}

    def test_1_create_branch(self, admin_token):
        r = requests.post(f"{BASE_URL}/branches", json={"name": "TEST_Branch", "address": "St 1", "phone": "1"},
                          headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        b = r.json()
        assert b["name"] == "TEST_Branch"
        self.__class__.created["branch"] = b["id"]

    def test_2_staff_cannot_create_branch(self, staff_token):
        r = requests.post(f"{BASE_URL}/branches", json={"name": "X"}, headers=_auth(staff_token))
        assert r.status_code == 403

    def test_3_list_branches_contains_new(self, admin_token):
        r = requests.get(f"{BASE_URL}/branches", headers=_auth(admin_token))
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert self.created["branch"] in ids

    def test_4_patch_branch(self, admin_token):
        bid = self.created["branch"]
        r = requests.patch(f"{BASE_URL}/branches/{bid}", json={"name": "TEST_Branch_X"}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Branch_X"

    def test_5_create_table_has_qr_token(self, admin_token):
        bid = self.created["branch"]
        r = requests.post(f"{BASE_URL}/branches/{bid}/tables", json={"label": "T1"}, headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        t = r.json()
        assert t["qr_token"] and len(t["qr_token"]) >= 8
        self.__class__.created["table"] = t["id"]
        self.__class__.created["qr"] = t["qr_token"]

    def test_6_qr_token_unique(self, admin_token):
        bid = self.created["branch"]
        r1 = requests.post(f"{BASE_URL}/branches/{bid}/tables", json={"label": "T2"}, headers=_auth(admin_token))
        r2 = requests.post(f"{BASE_URL}/branches/{bid}/tables", json={"label": "T3"}, headers=_auth(admin_token))
        assert r1.status_code == 201 and r2.status_code == 201
        assert r1.json()["qr_token"] != r2.json()["qr_token"]

    def test_7_create_category(self, admin_token):
        bid = self.created["branch"]
        r = requests.post(f"{BASE_URL}/categories", json={
            "branch_id": bid, "name": {"ar": "TEST_تصنيف", "en": "TEST_Cat"}, "sort_order": 0,
        }, headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        self.__class__.created["cat"] = r.json()["id"]

    def test_8_create_item(self, admin_token):
        r = requests.post(f"{BASE_URL}/items", json={
            "branch_id": self.created["branch"],
            "category_id": self.created["cat"],
            "name": {"ar": "TEST_صنف", "en": "TEST_Item"},
            "description": {"ar": "d", "en": "d"},
            "price": 25.5,
        }, headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        item = r.json()
        assert item["price"] == 25.5
        assert item["available"] is True and item["visible"] is True
        self.__class__.created["item"] = item["id"]

    def test_9_toggle_availability(self, admin_token):
        iid = self.created["item"]
        r = requests.patch(f"{BASE_URL}/items/{iid}/availability", json={"value": False}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["available"] is False

    def test_10_toggle_visibility(self, admin_token):
        iid = self.created["item"]
        r = requests.patch(f"{BASE_URL}/items/{iid}/visibility", json={"value": False}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["visible"] is False
        # revert
        requests.patch(f"{BASE_URL}/items/{iid}/visibility", json={"value": True}, headers=_auth(admin_token))
        requests.patch(f"{BASE_URL}/items/{iid}/availability", json={"value": True}, headers=_auth(admin_token))

    def test_11_price_update_logs_change(self, admin_token):
        iid = self.created["item"]
        r = requests.patch(f"{BASE_URL}/items/{iid}", json={"price": 40.0}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["price"] == 40.0

    def test_12_staff_cannot_toggle_item(self, staff_token):
        iid = self.created["item"]
        r = requests.patch(f"{BASE_URL}/items/{iid}/availability", json={"value": True}, headers=_auth(staff_token))
        assert r.status_code == 403

    def test_13_change_logs_recorded(self, admin_token):
        r = requests.get(f"{BASE_URL}/change-logs", headers=_auth(admin_token))
        assert r.status_code == 200
        logs = r.json()
        actions = {l["action"] for l in logs}
        # Sensitive edits should be present
        assert "update_price" in actions
        assert "toggle_availability" in actions
        assert "toggle_orders" in actions

    def test_14_staff_cannot_get_change_logs(self, staff_token):
        r = requests.get(f"{BASE_URL}/change-logs", headers=_auth(staff_token))
        assert r.status_code == 403

    def test_15_cleanup_delete_branch_cascade(self, admin_token):
        bid = self.created["branch"]
        r = requests.delete(f"{BASE_URL}/branches/{bid}", headers=_auth(admin_token))
        assert r.status_code == 200
        # tables under branch should be gone (Get returns 404 for branch)
        r2 = requests.get(f"{BASE_URL}/branches/{bid}/tables", headers=_auth(admin_token))
        assert r2.status_code == 404


# ---------------- Staff mgmt ----------------
class TestStaffMgmt:
    def test_admin_list_staff(self, admin_token):
        r = requests.get(f"{BASE_URL}/staff", headers=_auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_forbidden_list_staff(self, staff_token):
        r = requests.get(f"{BASE_URL}/staff", headers=_auth(staff_token))
        assert r.status_code == 403

    def test_admin_create_and_delete_staff(self, admin_token):
        email = f"TEST_staff_{uuid.uuid4().hex[:6]}@demo.com"
        r = requests.post(f"{BASE_URL}/staff", json={
            "name": "TEST Staff", "email": email, "password": "pass1234",
        }, headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        sid = r.json()["id"]
        assert r.json()["role"] == "staff"
        d = requests.delete(f"{BASE_URL}/staff/{sid}", headers=_auth(admin_token))
        assert d.status_code == 200


# ---------------- Public menu ----------------
class TestPublicMenu:
    def test_public_menu_valid_token(self):
        r = requests.get(f"{BASE_URL}/public/menu/{DEMO_QR}")
        assert r.status_code == 200
        d = r.json()
        assert d["restaurant"]["name"]
        assert d["table"]["label"]
        assert isinstance(d["categories"], list)
        # seeded item should be present + visible
        found = False
        for c in d["categories"]:
            for it in c["items"]:
                if it.get("visible") is not False:
                    found = True
        assert found

    def test_public_menu_invalid_token(self):
        r = requests.get(f"{BASE_URL}/public/menu/does-not-exist-xyz")
        assert r.status_code == 404

    def test_public_menu_no_auth_required(self):
        r = requests.get(f"{BASE_URL}/public/menu/{DEMO_QR}", headers={"Authorization": "Bearer bad"})
        # invalid token should still be ignored since endpoint has no auth
        assert r.status_code == 200


# ---------------- Multi-tenant isolation ----------------
class TestTenantIsolation:
    def test_tenant_a_cannot_read_tenant_b_branch(self):
        # create two tenants
        eA = f"TEST_a_{uuid.uuid4().hex[:6]}@demo.com"
        eB = f"TEST_b_{uuid.uuid4().hex[:6]}@demo.com"
        respA = requests.post(f"{BASE_URL}/auth/register", json={"restaurant_name": "AA_Tenant", "email": eA, "password": "pass1234"})
        respB = requests.post(f"{BASE_URL}/auth/register", json={"restaurant_name": "BB_Tenant", "email": eB, "password": "pass1234"})
        assert respA.status_code == 200, f"register A failed: {respA.status_code} {respA.text}"
        assert respB.status_code == 200, f"register B failed: {respB.status_code} {respB.text}"
        tokA = respA.json()["access_token"]
        tokB = respB.json()["access_token"]
        # A creates branch
        b = requests.post(f"{BASE_URL}/branches", json={"name": "A-Branch"}, headers=_auth(tokA)).json()
        # B tries to update / delete A's branch
        r_upd = requests.patch(f"{BASE_URL}/branches/{b['id']}", json={"name": "hack"}, headers=_auth(tokB))
        assert r_upd.status_code == 404
        r_del = requests.delete(f"{BASE_URL}/branches/{b['id']}", headers=_auth(tokB))
        assert r_del.status_code == 404
        # B list branches: A's branch must not appear
        listB = requests.get(f"{BASE_URL}/branches", headers=_auth(tokB)).json()
        assert all(x["id"] != b["id"] for x in listB)

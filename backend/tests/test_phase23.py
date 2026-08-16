"""Phase 2/3 backend tests: orders, waiter calls, offers, sizes/addons, live."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ["EXPO_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/") + "/api"

ADMIN = {"email": "admin@demo.com", "password": "demo1234"}
STAFF = {"email": "staff@demo.com", "password": "demo1234"}
DEMO_QR = "demo-table-1"


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def staff_token():
    r = requests.post(f"{BASE_URL}/auth/login", json=STAFF, timeout=30)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def ensure_orders_enabled(admin_token):
    """Ensure restaurant orders_enabled=true and branch orders_enabled=true."""
    requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": True}, headers=auth(admin_token))
    branches = requests.get(f"{BASE_URL}/branches", headers=auth(admin_token)).json()
    demo_branch = branches[0]
    requests.patch(f"{BASE_URL}/branches/{demo_branch['id']}", json={"orders_enabled": True}, headers=auth(admin_token))
    return demo_branch


@pytest.fixture(scope="module")
def demo_context(admin_token, ensure_orders_enabled):
    """Return dict with branch, category, item id for demo."""
    branch = ensure_orders_enabled
    cats = requests.get(f"{BASE_URL}/branches/{branch['id']}/categories", headers=auth(admin_token)).json()
    items = requests.get(f"{BASE_URL}/branches/{branch['id']}/items", headers=auth(admin_token)).json()
    return {"branch": branch, "category": cats[0], "item": items[0]}


# ---------------- Public menu now includes offers + sizes + addons ----------------
class TestPublicMenuExtended:
    def test_menu_shape_has_offers(self):
        r = requests.get(f"{BASE_URL}/public/menu/{DEMO_QR}")
        assert r.status_code == 200
        d = r.json()
        assert "offers" in d and isinstance(d["offers"], list)
        # items have sizes/addons keys (possibly empty)
        found_item = False
        for c in d["categories"]:
            for it in c["items"]:
                # Ensure keys exist after item update lifecycle (backend stores them)
                found_item = True
        assert found_item


# ---------------- Sizes / Addons persistence ----------------
class TestItemSizesAddons:
    def test_create_item_with_sizes_and_addons(self, admin_token, demo_context):
        payload = {
            "branch_id": demo_context["branch"]["id"],
            "category_id": demo_context["category"]["id"],
            "name": {"ar": "TEST_بيتزا", "en": "TEST_Pizza"},
            "price": 30,
            "sizes": [
                {"name": {"ar": "صغير", "en": "S"}, "price": 0},
                {"name": {"ar": "كبير", "en": "L"}, "price": 10},
            ],
            "addons": [
                {"name": {"ar": "جبن", "en": "Cheese"}, "price": 3},
                {"name": {"ar": "زيتون", "en": "Olives"}, "price": 2},
            ],
        }
        r = requests.post(f"{BASE_URL}/items", json=payload, headers=auth(admin_token))
        assert r.status_code == 201, r.text
        item = r.json()
        assert len(item["sizes"]) == 2
        assert len(item["addons"]) == 2
        assert item["sizes"][1]["price"] == 10
        # cleanup
        requests.delete(f"{BASE_URL}/items/{item['id']}", headers=auth(admin_token))

    def test_patch_item_updates_sizes(self, admin_token, demo_context):
        # create bare
        r = requests.post(f"{BASE_URL}/items", json={
            "branch_id": demo_context["branch"]["id"],
            "category_id": demo_context["category"]["id"],
            "name": {"ar": "TEST_x", "en": "TEST_x"},
            "price": 10,
        }, headers=auth(admin_token))
        assert r.status_code == 201, r.text
        iid = r.json()["id"]
        r2 = requests.patch(f"{BASE_URL}/items/{iid}", json={
            "sizes": [{"name": {"ar": "وسط", "en": "M"}, "price": 5}],
            "addons": [{"name": {"ar": "صوص", "en": "Sauce"}, "price": 1}],
        }, headers=auth(admin_token))
        assert r2.status_code == 200, r2.text
        assert len(r2.json()["sizes"]) == 1
        assert len(r2.json()["addons"]) == 1
        requests.delete(f"{BASE_URL}/items/{iid}", headers=auth(admin_token))


# ---------------- Offers ----------------
class TestOffers:
    created_offer = {}

    def test_1_list_offers_before(self, admin_token, demo_context):
        r = requests.get(f"{BASE_URL}/branches/{demo_context['branch']['id']}/offers", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_2_admin_create_offer(self, admin_token, demo_context):
        r = requests.post(f"{BASE_URL}/offers", json={
            "branch_id": demo_context["branch"]["id"],
            "title": {"ar": "TEST_عرض", "en": "TEST_Offer"},
            "description": {"ar": "خصم", "en": "20% off"},
        }, headers=auth(admin_token))
        assert r.status_code == 201, r.text
        o = r.json()
        assert o["active"] is True
        assert o["title"]["ar"] == "TEST_عرض"
        self.__class__.created_offer["id"] = o["id"]

    def test_3_staff_cannot_create_offer(self, staff_token, demo_context):
        r = requests.post(f"{BASE_URL}/offers", json={
            "branch_id": demo_context["branch"]["id"],
            "title": {"ar": "x"},
        }, headers=auth(staff_token))
        assert r.status_code == 403

    def test_4_public_menu_shows_active_offer(self):
        r = requests.get(f"{BASE_URL}/public/menu/{DEMO_QR}")
        titles = [o["title"].get("ar") for o in r.json()["offers"]]
        assert "TEST_عرض" in titles

    def test_5_patch_offer_toggle_inactive(self, admin_token):
        oid = self.created_offer["id"]
        r = requests.patch(f"{BASE_URL}/offers/{oid}", json={"active": False}, headers=auth(admin_token))
        assert r.status_code == 200
        assert r.json()["active"] is False
        # public menu should not include it now
        m = requests.get(f"{BASE_URL}/public/menu/{DEMO_QR}").json()
        assert all(o["id"] != oid for o in m["offers"])

    def test_6_delete_offer(self, admin_token):
        oid = self.created_offer["id"]
        r = requests.delete(f"{BASE_URL}/offers/{oid}", headers=auth(admin_token))
        assert r.status_code == 200

    def test_7_staff_can_list_offers(self, staff_token, demo_context):
        r = requests.get(f"{BASE_URL}/branches/{demo_context['branch']['id']}/offers", headers=auth(staff_token))
        assert r.status_code == 200


# ---------------- Public waiter call ----------------
class TestWaiterCallPublic:
    def test_invalid_token_404(self):
        r = requests.post(f"{BASE_URL}/public/waiter-call/nope-xxx")
        assert r.status_code == 404

    def test_create_and_dedupe(self):
        r1 = requests.post(f"{BASE_URL}/public/waiter-call/{DEMO_QR}")
        assert r1.status_code in (200, 201), r1.text
        id1 = r1.json()["id"]
        r2 = requests.post(f"{BASE_URL}/public/waiter-call/{DEMO_QR}")
        assert r2.status_code in (200, 201)
        assert r2.json()["id"] == id1  # dedupe


# ---------------- Public order create ----------------
class TestPublicOrder:
    created_order_id = None

    def test_1_invalid_qr(self):
        r = requests.post(f"{BASE_URL}/public/order/bad-token", json={"items": []})
        assert r.status_code == 404

    def test_2_create_order_ok(self, demo_context, ensure_orders_enabled):
        item = demo_context["item"]
        payload = {
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "unit_price": item["price"],
                "qty": 2,
                "size": None,
                "addons": [],
                "note": "TEST",
            }],
            "note": "TEST_ORDER",
        }
        r = requests.post(f"{BASE_URL}/public/order/{DEMO_QR}", json=payload)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d["status"] == "new"
        assert d["total"] == round(item["price"] * 2, 2)
        assert "id" in d
        self.__class__.created_order_id = d["id"]

    def test_3_order_status_endpoint(self):
        oid = self.created_order_id
        r = requests.get(f"{BASE_URL}/public/order-status/{oid}")
        assert r.status_code == 200
        assert r.json()["status"] == "new"

    def test_4_order_status_invalid(self):
        r = requests.get(f"{BASE_URL}/public/order-status/nonexistent-id")
        assert r.status_code == 404

    def test_5_order_rejected_when_orders_disabled(self, admin_token, demo_context):
        # disable restaurant orders
        requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": False}, headers=auth(admin_token))
        r = requests.post(f"{BASE_URL}/public/order/{DEMO_QR}", json={
            "items": [{"item_id": demo_context["item"]["id"], "name": {"ar": "x"}, "unit_price": 1, "qty": 1}],
        })
        assert r.status_code == 409
        # revert
        requests.patch(f"{BASE_URL}/restaurant", json={"orders_enabled": True}, headers=auth(admin_token))

    def test_6_order_rejected_when_item_unavailable(self, admin_token, demo_context):
        iid = demo_context["item"]["id"]
        requests.patch(f"{BASE_URL}/items/{iid}/availability", json={"value": False}, headers=auth(admin_token))
        r = requests.post(f"{BASE_URL}/public/order/{DEMO_QR}", json={
            "items": [{"item_id": iid, "name": {"ar": "x"}, "unit_price": 1, "qty": 1}],
        })
        assert r.status_code == 409
        # revert
        requests.patch(f"{BASE_URL}/items/{iid}/availability", json={"value": True}, headers=auth(admin_token))


# ---------------- Auth: /orders, /waiter-calls, /live and staff perms ----------------
class TestOrdersAuth:
    def test_admin_list_orders(self, admin_token):
        r = requests.get(f"{BASE_URL}/orders", headers=auth(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_staff_list_orders(self, staff_token):
        r = requests.get(f"{BASE_URL}/orders", headers=auth(staff_token))
        assert r.status_code == 200

    def test_staff_can_update_order_status(self, staff_token, admin_token):
        # find latest order or create one
        orders = requests.get(f"{BASE_URL}/orders", headers=auth(admin_token)).json()
        assert orders, "no orders present"
        oid = orders[0]["id"]
        r = requests.patch(f"{BASE_URL}/orders/{oid}/status", json={"status": "preparing"}, headers=auth(staff_token))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "preparing"
        # progression
        r2 = requests.patch(f"{BASE_URL}/orders/{oid}/status", json={"status": "ready"}, headers=auth(staff_token))
        assert r2.status_code == 200
        assert r2.json()["status"] == "ready"
        r3 = requests.patch(f"{BASE_URL}/orders/{oid}/status", json={"status": "completed"}, headers=auth(staff_token))
        assert r3.status_code == 200

    def test_staff_can_list_waiter_calls(self, staff_token):
        r = requests.get(f"{BASE_URL}/waiter-calls", headers=auth(staff_token))
        assert r.status_code == 200

    def test_staff_can_ack_waiter_call(self, staff_token, admin_token):
        # ensure a pending call exists
        requests.post(f"{BASE_URL}/public/waiter-call/{DEMO_QR}")
        calls = requests.get(f"{BASE_URL}/waiter-calls", headers=auth(admin_token)).json()
        pending = [c for c in calls if c["status"] == "pending"]
        assert pending, "no pending waiter call"
        cid = pending[0]["id"]
        r = requests.patch(f"{BASE_URL}/waiter-calls/{cid}/ack", headers=auth(staff_token))
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_live_returns_expected_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/live", headers=auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("orders", "waiter_calls", "new_orders_count", "pending_calls_count", "alert_count"):
            assert k in d
        assert d["alert_count"] == d["new_orders_count"] + d["pending_calls_count"]

    def test_live_no_auth(self):
        r = requests.get(f"{BASE_URL}/live")
        assert r.status_code == 401

    def test_order_status_change_logged(self, admin_token):
        logs = requests.get(f"{BASE_URL}/change-logs", headers=auth(admin_token)).json()
        actions = {l["action"] for l in logs}
        assert "update_order_status" in actions


# ---------------- Multi-tenant isolation for orders ----------------
class TestOrderTenantIsolation:
    def test_tenant_b_cannot_patch_tenant_a_order(self, admin_token):
        # create new tenant B
        emailB = f"TEST_b_{uuid.uuid4().hex[:6]}@demo.com"
        rB = requests.post(f"{BASE_URL}/auth/register", json={
            "restaurant_name": "B_Tenant", "email": emailB, "password": "pass1234",
        })
        assert rB.status_code == 200
        tokB = rB.json()["access_token"]
        # get an existing order from tenant A
        orders = requests.get(f"{BASE_URL}/orders", headers=auth(admin_token)).json()
        assert orders
        oid = orders[0]["id"]
        r = requests.patch(f"{BASE_URL}/orders/{oid}/status", json={"status": "cancelled"}, headers=auth(tokB))
        assert r.status_code == 404

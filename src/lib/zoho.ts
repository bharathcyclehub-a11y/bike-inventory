import { prisma } from "@/lib/db";

const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.in/oauth/v2/token";
const ZOHO_API_BASE = "https://www.zohoapis.in/books/v3";

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  error?: string;
}

export class ZohoClient {
  private accessToken: string | null = null;
  private organizationId: string | null = null;

  async init(): Promise<boolean> {
    const config = await prisma.zohoConfig.findUnique({ where: { id: "singleton" } });
    if (!config || !config.isConnected || !config.refreshToken) return false;

    this.organizationId = config.organizationId;

    // Check if access token is still valid (with 5 min buffer)
    if (config.accessToken && config.accessTokenExpiresAt) {
      const buffer = 5 * 60 * 1000;
      if (new Date(config.accessTokenExpiresAt).getTime() - buffer > Date.now()) {
        this.accessToken = config.accessToken;
        return true;
      }
    }

    // Refresh the token
    return this.refreshAccessToken(config.clientId!, config.clientSecret!, config.refreshToken);
  }

  private async refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<boolean> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });

    const res = await fetch(ZOHO_ACCOUNTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data: ZohoTokenResponse = await res.json();
    if (data.error || !data.access_token) return false;

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    this.accessToken = data.access_token;

    await prisma.zohoConfig.update({
      where: { id: "singleton" },
      data: { accessToken: data.access_token, accessTokenExpiresAt: expiresAt },
    });

    return true;
  }

  async apiCall<T>(method: string, endpoint: string, body?: Record<string, unknown>): Promise<T> {
    if (!this.accessToken || !this.organizationId) {
      throw new Error("Zoho client not initialized");
    }

    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${ZOHO_API_BASE}${endpoint}${separator}organization_id=${this.organizationId}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 429) {
      throw new Error("Zoho API rate limit exceeded. Try again later.");
    }

    const data = await res.json();
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(data.message || `Zoho API error: ${data.code}`);
    }

    return data as T;
  }

  // ---- Items (Products) ----

  async createItem(product: {
    sku: string; name: string; costPrice: number; sellingPrice: number;
    hsnCode?: string | null; gstRate: number;
  }) {
    return this.apiCall("POST", "/items", {
      JSONString: JSON.stringify({
        name: product.name,
        sku: product.sku,
        rate: product.sellingPrice,
        purchase_rate: product.costPrice,
        hsn_or_sac: product.hsnCode || undefined,
        item_type: "inventory",
        product_type: "goods",
      }),
    });
  }

  async listItems(page = 1) {
    return this.apiCall<{ items: Array<{ item_id: string; sku: string; name: string }> }>(
      "GET", `/items?page=${page}`
    );
  }

  // ---- Contacts (Vendors) ----

  async createContact(vendor: {
    name: string; gstin?: string | null; email?: string | null;
    phone?: string | null; city?: string | null; state?: string | null;
  }) {
    return this.apiCall("POST", "/contacts", {
      JSONString: JSON.stringify({
        contact_name: vendor.name,
        contact_type: "vendor",
        gst_no: vendor.gstin || undefined,
        email: vendor.email || undefined,
        phone: vendor.phone || undefined,
        billing_address: {
          city: vendor.city || undefined,
          state: vendor.state || undefined,
        },
      }),
    });
  }

  // ---- Invoices (Outward Transactions) ----

  async createInvoice(data: {
    customerName: string; referenceNo?: string;
    lineItems: Array<{ name: string; sku: string; quantity: number; rate: number }>;
    date: string;
  }) {
    return this.apiCall("POST", "/invoices", {
      JSONString: JSON.stringify({
        customer_name: data.customerName || "Walk-in Customer",
        reference_number: data.referenceNo,
        date: data.date,
        line_items: data.lineItems.map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          rate: item.rate,
        })),
      }),
    });
  }

  // ---- Bills (Purchase Orders / Vendor Bills) ----

  async createBill(data: {
    vendorName: string; billNo: string; billDate: string;
    dueDate: string; amount: number;
    lineItems: Array<{ name: string; quantity: number; rate: number }>;
  }) {
    return this.apiCall("POST", "/bills", {
      JSONString: JSON.stringify({
        vendor_name: data.vendorName,
        bill_number: data.billNo,
        date: data.billDate,
        due_date: data.dueDate,
        line_items: data.lineItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          rate: item.rate,
        })),
      }),
    });
  }

  // ---- Organizations ----

  async getOrganizations() {
    return this.apiCall<{ organizations: Array<{ organization_id: string; name: string }> }>(
      "GET", "/../organizations"
    );
  }
}

// Exchange grant token for refresh token (one-time setup)
export async function exchangeGrantToken(clientId: string, clientSecret: string, grantToken: string) {
  const params = new URLSearchParams({
    code: grantToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
  });

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresIn: data.expires_in as number,
  };
}

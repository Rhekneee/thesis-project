# PayMongo Payment Integration Setup Guide

## Overview
This project supports **PayMongo** payment integration for online payments through PayMongo Checkout. When users click "Online Payment", they will be redirected to PayMongo's secure payment page where they can pay via Credit Card, GCash, or GrabPay.

## Features
✅ **PayMongo Checkout Integration** - Secure payment processing via PayMongo  
✅ **Multiple Payment Methods** - Support for Card, GCash, and GrabPay  
✅ **Automatic Payment Recording** - Payments are automatically recorded in database  
✅ **Payment Status Updates** - Billing status updates automatically when payment is completed  
✅ **Webhook Support** - Real-time payment confirmation via PayMongo webhooks  
✅ **Payment Receipt** - Session ID is stored as payment reference  

## Setup Instructions

### 1. Install Dependencies
```bash
npm install paymongo
```

### 2. Get PayMongo API Keys
1. Go to [https://paymongo.com](https://paymongo.com)
2. Sign up or log in to your account
3. Navigate to **Settings** > **API Keys**
4. Get your **Secret Key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
5. Get your **Public Key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)

### 3. Configure Environment Variables

Add the following variables to your `.env` file:

```env
# PayMongo Configuration
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 4. Set Up PayMongo Webhook (Recommended)

To receive real-time payment confirmations:

1. Go to [PayMongo Dashboard](https://dashboard.paymongo.com)
2. Navigate to **Developers** > **Webhooks**
3. Click **"Add endpoint"** or **"Create Webhook"**
4. Enter your webhook URL: `https://yourdomain.com/manufacturing/paymongo-webhook`
5. Select events to listen to:
   - `checkout.payment.paid`
   - `payment.paid`
6. Copy the **Signing secret** and add it to your `.env` file as `PAYMONGO_WEBHOOK_SECRET`

## How It Works

### Payment Flow

1. **User clicks "Online Payment"**
   - Frontend calls `POST /manufacturing/create-payment-intent`
   - Backend creates a PayMongo Checkout Session
   - Returns PayMongo Checkout URL to frontend

2. **User redirected to PayMongo Checkout**
   - Secure payment page hosted by PayMongo
   - User can choose: Credit Card, GCash, or GrabPay
   - User enters payment details

3. **Payment Completed**
   - User redirected back to success/cancel URL
   - Webhook fires to confirm payment
   - Payment record stored in database
   - Billing status updated automatically

### API Endpoints

#### Create Payment Intent
```javascript
POST /manufacturing/create-payment-intent
Content-Type: application/json

{
  "billing_id": 123,
  "amount": 5000.00,
  "reference": "SB-2024-123456",
  "remarks": "Payment for foundation work"
}

Response:
{
  "success": true,
  "url": "https://pay.paymongo.com/checkout/...",
  "session_id": "ch_test_...",
  "client_secret": "ch_test_..."
}
```

#### PayMongo Webhook
```javascript
POST /manufacturing/paymongo-webhook
Headers: paymongo-signature
Body: Raw JSON from PayMongo
```

#### Payment Callbacks
```javascript
GET /manufacturing/payments/success?checkout_session_id=...&billing_id=...
GET /manufacturing/payments/cancel?billing_id=...
```

## Testing

### Test Cards

PayMongo provides test cards for development:

**Successful Payment:**
- Card Number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

**Payment Requires Authentication:**
- Card Number: `4000 0000 0000 3220`

**Payment Declined:**
- Card Number: `4000 0000 0000 0002`

### Test Mode vs Live Mode

- **Test Mode** (recommended for development):
  - Use `sk_test_...` secret key
  - Use `pk_test_...` public key
  - No real money is charged
  - See test mode transactions in dashboard

- **Live Mode** (production):
  - Use `sk_live_...` secret key
  - Use `pk_live_...` public key
  - Real money is charged
  - Requires verified PayMongo account

## Supported Payment Methods

PayMongo supports multiple payment methods for Philippine users:

1. **Credit/Debit Cards**
   - Visa
   - Mastercard
   - JCB
   - American Express

2. **Digital Wallets**
   - GCash
   - GrabPay

3. **Mobile Banking** (via PayMongo)

## Database

The payment is automatically stored in the `stage_billing_payment` table:

```sql
INSERT INTO stage_billing_payment (
  stage_billing_id,
  payment_method,
  payment_reference,
  amount_paid,
  remarks
) VALUES (
  123,              -- billing_id
  'paymongo',       -- payment_method
  'ch_test_...',    -- payment_reference (checkout ID)
  5000.00,          -- amount_paid
  'PayMongo payment completed...'  -- remarks
);
```

## Troubleshooting

### Error: "PayMongo is not configured"
- Make sure `PAYMONGO_SECRET_KEY` is set in `.env`
- Restart the server after adding environment variables

### Error: "Webhook signature verification failed"
- Make sure `PAYMONGO_WEBHOOK_SECRET` is set correctly
- Verify the webhook URL is correct in PayMongo dashboard
- Check that webhook is receiving raw JSON body

### Payment not recorded
- Check PayMongo webhook is set up correctly
- Check server logs for webhook processing errors
- Verify database connection

### GCash/GrabPay not showing
- Ensure PayMongo account is activated for these payment methods
- Check that payment method types are enabled in account settings

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to version control
- Use test keys for development
- Keep production keys secure
- PayMongo webhooks verify signatures for security
- All payments go through PayMongo's secure servers

## Comparison: PayMongo vs Stripe

### Advantages of PayMongo:
- ✅ **Philippines-focused** - Built for Filipino businesses
- ✅ **Local payment methods** - GCash, GrabPay support
- ✅ **Simpler integration** - Easier API structure
- ✅ **No currency conversion** - Direct PHP transactions
- ✅ **Lower fees** - Competitive pricing for PH market

### Key Differences:
- PayMongo: Uses checkout sessions with line items
- Stripe: Uses payment intents and checkout sessions
- PayMongo: Amount in centavos (smallest currency unit)
- Stripe: Amount in cents (smallest currency unit)

## Support

For more information:
- [PayMongo Documentation](https://developers.paymongo.com/docs)
- [PayMongo API Reference](https://developers.paymongo.com/reference)
- [PayMongo Webhooks](https://developers.paymongo.com/docs/webhooks)
- [PayMongo Sandbox](https://developers.paymongo.com/docs/testing)

## Migration from Stripe

If you were using Stripe before and migrated to PayMongo:

1. ✅ Replaced `stripe` package with `paymongo` package
2. ✅ Updated environment variables from `STRIPE_*` to `PAYMONGO_*`
3. ✅ Changed API endpoints to use PayMongo SDK
4. ✅ Updated webhook handlers to use PayMongo events
5. ✅ Changed payment method names in database from 'stripe' to 'paymongo'


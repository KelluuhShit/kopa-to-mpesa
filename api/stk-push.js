if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');

module.exports = async (req, res) => {
  const allowedOrigins = [
    'https://kopa-mobile-to-mpesa.vercel.app',
    'https://kopa-mobile-to-mpesa.vercel.app', // For local development
  ];
  const origin = req.headers.origin;

  // Handle CORS
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } else if (req.method !== 'OPTIONS') {
    return res.status(403).json({ success: false, error: 'CORS origin not allowed' });
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Restrict to POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { phoneNumber, amount, reference } = req.body;
  console.log(`[${new Date().toISOString()}] STK Push requested - Phone: ${phoneNumber}, Amount: ${amount}, Client Reference: ${reference}`);

  // Validate inputs
  if (!phoneNumber || !amount || !reference) {
    console.log('Missing required fields:', { phoneNumber, amount, reference });
    return res.status(400).json({ success: false, error: 'Missing phoneNumber, amount, or reference' });
  }

  let formattedPhone = phoneNumber;
  if (phoneNumber.startsWith('0')) {
    formattedPhone = `254${phoneNumber.slice(1)}`;
  } else if (phoneNumber.startsWith('+254')) {
    formattedPhone = phoneNumber.slice(1);
  }

  console.log(`Formatted phone number: ${formattedPhone}`);

  if (!/^(0[17]\d{8}|\+254[17]\d{8}|254[17]\d{8})$/.test(phoneNumber)) {
    console.log('Invalid phone number:', phoneNumber);
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format. Use 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX',
    });
  }

  if (isNaN(amount) || amount < 1) {
    console.log('Invalid amount:', amount);
    return res.status(400).json({ success: false, error: 'Amount must be at least 1 KES' });
  }

  try {
    const apiUsername = process.env.PAYHERO_API_USERNAME;
    const apiPassword = process.env.PAYHERO_API_PASSWORD;
    const callbackUrl = process.env.PAYHERO_CALLBACK_URL;

    if (!apiUsername || !apiPassword) {
      console.error('Missing PayHero API credentials');
      return res.status(500).json({ success: false, error: 'Server configuration error: Missing API credentials' });
    }

    if (!callbackUrl) {
      console.error('Missing PAYHERO_CALLBACK_URL');
      return res.status(500).json({ success: false, error: 'Server configuration error: Missing callback URL' });
    }

    const authToken = `Basic ${Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64')}`;

    const payload = {
      amount: Number(amount),
      phone_number: formattedPhone,
      channel_id: 2209,
      provider: 'm-pesa',
      external_reference: reference,
      callback_url: callbackUrl,
    };

    console.log('Sending PayHero payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://backend.payhero.co.ke/api/v2/payments',
      payload,
      {
        headers: { Authorization: authToken, 'Content-Type': 'application/json' },
        timeout: 20000,
      }
    );

    const payheroData = response.data;
    console.log('PayHero STK Push response:', JSON.stringify(payheroData, null, 2));

    if (payheroData.status === 'QUEUED' || payheroData.status === 'PENDING' || payheroData.success) {
      const payheroReference = payheroData.reference || payheroData.external_reference;
      if (!payheroReference) {
        console.error('PayHero response missing reference:', payheroData);
        return res.status(500).json({ success: false, error: 'PayHero did not return a reference' });
      }
      return res.status(200).json({
        success: true,
        clientReference: reference,
        payheroReference,
        message: 'STK Push initiated successfully',
      });
    } else {
      console.log('PayHero STK Push failed:', payheroData);
      return res.status(400).json({
        success: false,
        error: payheroData.error || 'STK Push initiation failed',
        data: payheroData,
      });
    }
  } catch (error) {
    const errorData = error.response?.data || { error_message: error.message };
    console.error('STK Push error:', JSON.stringify(errorData, null, 2));
    return res.status(400).json({
      success: false,
      error: errorData.error_message || 'An unexpected error occurred',
      data: errorData,
    });
  }
};
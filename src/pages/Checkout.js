import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  CircularProgress,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { db, analytics, logEvent } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const {
    loanAmount = 0,
    serviceFee = 0,
    trackingNumber = '',
    reference = '',
    phoneNumber = '',
    nationalId = '',
    fullName = '',
  } = state || {};

  const [status, setStatus] = useState('QUEUED');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); // Start as true for Firestore fetch
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [transactionData, setTransactionData] = useState({
    loanAmount,
    serviceFee,
    trackingNumber,
    reference,
    phoneNumber,
    nationalId,
    fullName,
  });

  // Fetch transaction data from Firestore
  useEffect(() => {
    const fetchTransactionData = async () => {
      if (!reference) {
        setError('Missing transaction reference.');
        setLoading(false);
        logEvent(analytics, 'checkout_invalid_state', {
          nationalId,
          reference: reference || 'none',
          trackingNumber,
        });
        return;
      }

      try {
        const transactionDocRef = doc(db, 'loanTransactions', reference);
        const transactionDoc = await getDoc(transactionDocRef);
        if (transactionDoc.exists()) {
          const data = transactionDoc.data();
          setTransactionData({
            loanAmount: data.loanAmount || loanAmount,
            serviceFee: data.serviceFee || serviceFee,
            trackingNumber: data.trackingNumber || trackingNumber,
            reference: data.reference || reference,
            phoneNumber: data.phoneNumber || phoneNumber,
            nationalId: data.nationalId || nationalId,
            fullName: data.fullName || fullName,
          });
          setStatus(data.status || 'QUEUED');
          logEvent(analytics, 'checkout_transaction_fetched', {
            nationalId: data.nationalId,
            reference: data.reference,
            trackingNumber: data.trackingNumber,
          });
        } else {
          setError('Transaction data not found in Firestore. Using provided details.');
          logEvent(analytics, 'checkout_transaction_not_found', {
            nationalId,
            reference,
            trackingNumber,
          });
        }
      } catch (err) {
        console.error('Error fetching transaction from Firestore:', err);
        setError('Failed to fetch transaction data from server. Displaying provided details.');
        logEvent(analytics, 'checkout_transaction_fetch_error', {
          nationalId,
          reference,
          error: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransactionData();
  }, [reference, loanAmount, serviceFee, trackingNumber, phoneNumber, nationalId, fullName]);

  // Poll transaction status (only if status is QUEUED)
  useEffect(() => {
    if (!reference || status !== 'QUEUED') return;

    const maxPollingDuration = 300000; // 5 minutes
    const startTime = Date.now();

    const pollStatus = async () => {
      if (Date.now() - startTime > maxPollingDuration) {
        setError('Transaction timed out. Please contact support.');
        setErrorModalOpen(true);
        setLoading(false);
        console.log('Polling stopped due to timeout');
        logEvent(analytics, 'checkout_polling_timeout', {
          nationalId,
          reference,
          trackingNumber,
        });
        return;
      }

      let retries = 3;
      let timeout = 20000;
      while (retries > 0) {
        try {
          const apiUrl = process.env.NODE_ENV === 'production'
            ? process.env.REACT_APP_API_URL || 'https://kopa-mobile-to-mpesa.vercel.app'
            : 'https://kopa-mobile-to-mpesa.vercel.app';
          console.log(`Polling status for PayHero reference: ${reference}`);
          const response = await axios.get(`${apiUrl}/api/transaction-status?reference=${reference}`, {
            timeout,
          });

          console.log('Status response:', response.data);
          if (response.data.success) {
            const newStatus = response.data.status;
            setStatus(newStatus);
            logEvent(analytics, 'checkout_transaction_status', {
              nationalId,
              reference,
              trackingNumber,
              status: newStatus,
            });

            if (newStatus === 'SUCCESS') {
              setLoading(false);
              setSuccessModalOpen(true);
            } else if (newStatus === 'FAILED' || newStatus === 'CANCELLED') {
              setError('Transaction failed or was cancelled. Please try again.');
              setErrorModalOpen(true);
              setLoading(false);
            }
            return;
          } else {
            throw new Error('Failed to check transaction status');
          }
        } catch (err) {
          retries -= 1;
          timeout += 5000;
          console.error(`Status polling error (attempt ${4 - retries}):`, err);
          if (retries === 0) {
            let errorMessage = 'Error checking transaction status. Retrying...';
            if (err.response?.status === 404) {
              setStatus('QUEUED');
              errorMessage = 'Transaction is being processed. Please wait...';
            } else if (err.response?.status === 400) {
              errorMessage = 'Invalid transaction reference. Please contact support.';
            } else if (err.code === 'ECONNABORTED') {
              errorMessage = 'Request timed out. Retrying...';
            }
            setError(errorMessage);
            logEvent(analytics, 'checkout_status_polling_error', {
              nationalId,
              reference,
              trackingNumber,
              error: err.message,
              statusCode: err.response?.status,
            });
          }
        }
      }
    };

    const intervalId = setInterval(pollStatus, 10000);
    return () => clearInterval(intervalId);
  }, [reference, status, nationalId, trackingNumber]);

  // Handle invalid state
  if (!transactionData.loanAmount || !transactionData.trackingNumber || !transactionData.reference || !transactionData.phoneNumber) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <FontAwesomeIcon
              icon={faExclamationCircle}
              style={{ fontSize: '60px', color: '#d32f2f', mb: 2 }}
              aria-label="Error icon"
            />
            <Typography
              variant="h6"
              sx={{ color: 'error.main', mb: 2 }}
            >
              Invalid Loan Details
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              Please try again or contact support.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/')}
              sx={{ px: 4, py: 1.5 }}
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: { xs: 2, sm: 0 } }}>
      <Card
        sx={{
          boxShadow: 6,
          borderRadius: 2,
          backgroundColor: 'background.paper',
        }}
      >
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <>
              <Fade in timeout={1000}>
                <Box sx={{ mb: 3 }}>
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    style={{ fontSize: '80px', color: '#4caf50' }}
                    aria-label="Success checkmark"
                  />
                </Box>
              </Fade>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2rem', sm: '2.5rem' },
                  fontWeight: 'bold',
                  color: 'primary.main',
                  mb: 2,
                }}
              >
                Loan Request Submitted
              </Typography>
              {error && (
                <Typography
                  variant="body1"
                  sx={{ color: 'error.main', mb: 3, fontStyle: 'italic' }}
                >
                  {error}
                </Typography>
              )}
              <Typography
                variant="body1"
                sx={{ color: 'text.secondary', mb: 3, fontStyle: 'italic' }}
              >
                Your loan is being processed. Funds will be disbursed to{' '}
                <strong>{transactionData.phoneNumber}</strong> after approval.
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 3,
                  color:
                    status === 'QUEUED'
                      ? 'info.main'
                      : status === 'SUCCESS'
                      ? 'success.main'
                      : 'error.main',
                  fontWeight: 'medium',
                }}
              >
                Transaction Status: <strong>{status}</strong>
                {status === 'QUEUED' && ' - Awaiting confirmation...'}
                {status === 'SUCCESS' && ' - Awaiting approval...'}
                {(status === 'FAILED' || status === 'CANCELLED') &&
                  ' - Please try again or contact support.'}
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: 'grey.50',
                  transition: 'box-shadow 0.3s',
                  '&:hover': {
                    boxShadow: 2,
                  },
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 'bold', mb: 2, color: 'text.primary' }}
                >
                  Loan Details
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Full Name:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {transactionData.fullName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    National ID:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {transactionData.nationalId}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Loan Amount:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    KES {transactionData.loanAmount.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Service Fee:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    KES {transactionData.serviceFee.toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Amount to Receive:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    KES {(transactionData.loanAmount - transactionData.serviceFee).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Phone Number:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {transactionData.phoneNumber}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Tracking Number:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {transactionData.trackingNumber}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Transaction Reference:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {transactionData.reference}
                  </Typography>
                </Box>
              </Box>
              <Typography
                variant="body1"
                sx={{ mt: 3, mb: 2, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center' }}
              >
                Your application is being processed and will be approved within 24 hours. If rejected, your service fee will be automatically reversed.
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold', textAlign: 'center' }}
              >
                Thank you for choosing Kopa Mobile to M-PESA!
              </Typography>
            </>
          )}
        </CardContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/', { state: { nationalId, fullName } })}
            sx={{
              px: 4,
              py: 1.5,
              fontWeight: 'bold',
              textTransform: 'none',
              borderRadius: 1,
            }}
            disabled={loading}
          >
            Back to Home
          </Button>
        </Box>
      </Card>

      {/* Success Modal */}
      <Dialog
        open={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          navigate('/', { state: { nationalId, fullName } });
        }}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 2, p: 2 } }}
      >
        <DialogContent sx={{ textAlign: 'center' }}>
          <FontAwesomeIcon
            icon={faCheckCircle}
            style={{ fontSize: '60px', color: '#4caf50', mb: 2 }}
            aria-label="Success checkmark"
          />
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            Loan Disbursed Successfully!
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Your loan of KES {(transactionData.loanAmount - transactionData.serviceFee).toLocaleString()} has been disbursed to{' '}
            <strong>{transactionData.phoneNumber}</strong>.
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center' }}
          >
            Your application is being processed and will be approved within 24 hours. If rejected, your service fee will be automatically reversed.
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 1, color: 'primary.main', fontWeight: 'bold', textAlign: 'center' }}
          >
            Thank you for choosing Kopa Mobile to M-PESA!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/', { state: { nationalId, fullName } })}
            sx={{ px: 4, py: 1 }}
          >
            Go to Home
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Modal */}
      <Dialog
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        maxWidth="xs"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 2, p: 2 } }}
      >
        <DialogContent sx={{ textAlign: 'center' }}>
          <FontAwesomeIcon
            icon={faExclamationCircle}
            style={{ fontSize: '60px', color: '#d32f2f', mb: 2 }}
            aria-label="Error icon"
          />
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            Transaction Error
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {error}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic', textAlign: 'center' }}
          >
            If your application is rejected, your service fee will be automatically reversed.
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 1, color: 'primary.main', fontWeight: 'bold', textAlign: 'center' }}
          >
            Thank you for choosing Kopa Mobile to M-PESA!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setErrorModalOpen(false);
              setError('');
              setStatus('QUEUED'); // Retry polling
            }}
            sx={{ px: 4, py: 1 }}
          >
            Retry
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/', { state: { nationalId, fullName } })}
            sx={{ px: 4, py: 1 }}
          >
            Back to Home
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Checkout;
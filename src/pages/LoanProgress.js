import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button,
  Grid,
} from '@mui/material';
import { db, analytics, logEvent } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

function LoanProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const { phoneNumber, nationalId } = location.state || {};
  const [loanData, setLoanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLoanData = async () => {
      if (!phoneNumber || !nationalId) {
        setError('Invalid access. Please track your loan from the home page.');
        setLoading(false);
        logEvent(analytics, 'loan_progress_error', {
          error: 'Missing phoneNumber or nationalId',
          phoneNumber: phoneNumber || 'none',
          nationalId: nationalId || 'none',
        });
        return;
      }

      try {
        const loansRef = collection(db, 'loanTransactions'); // Updated to loanTransactions
        const q = query(
          loansRef,
          where('phoneNumber', '==', phoneNumber),
          where('nationalId', '==', nationalId)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const loans = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setLoanData(loans);
          logEvent(analytics, 'loan_progress_viewed', {
            phoneNumber,
            nationalId,
            loanCount: loans.length,
          });
        } else {
          setError('No loan applications found for the provided details.');
          logEvent(analytics, 'loan_progress_not_found', { phoneNumber, nationalId });
        }
      } catch (err) {
        let errorMessage = 'An error occurred while fetching loan data. Please try again.';
        if (err.code === 'permission-denied') {
          errorMessage = 'Permission denied. Please contact support.';
        } else if (err.code === 'unavailable') {
          errorMessage = 'Server is temporarily unavailable. Please try again later.';
        }
        setError(errorMessage);
        logEvent(analytics, 'loan_progress_error', {
          error: err.message,
          code: err.code || 'unknown',
          phoneNumber,
          nationalId,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLoanData();
  }, [phoneNumber, nationalId]);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: { xs: 2, sm: 0 } }}>
      <Typography
        variant="h1"
        gutterBottom
        sx={{
          fontSize: { xs: '1.8rem', sm: '2.2rem', md: '3rem' },
          textAlign: 'center',
          fontWeight: 'bold',
          color: 'primary.main',
        }}
        id="loan-progress-title"
      >
        Loan Progress
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress aria-label="Loading loan progress" />
        </Box>
      ) : error ? (
        <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <Typography color="error" sx={{ mb: 2 }} role="alert">
              {error}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => window.location.reload()}
                aria-label="Retry fetching loan data"
              >
                Retry
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/')}
                aria-label="Return to home page"
              >
                Back to Home
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box role="region" aria-labelledby="loan-progress-title">
          {loanData.length === 0 ? (
            <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
              <CardContent sx={{ textAlign: 'center', p: 4 }}>
                <Typography sx={{ mb: 2 }}>
                  No loan applications found.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/')}
                  aria-label="Return to home page"
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {loanData.map((loan) => (
                <Grid item xs={12} key={loan.id}>
                  <Card sx={{ boxShadow: 6, borderRadius: 2 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography
                        variant="h6"
                        sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}
                      >
                        Loan Application: {loan.trackingNumber || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Full Name:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {loan.fullName || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          National ID:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {loan.nationalId || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Phone Number:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {loan.phoneNumber || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Loan Amount:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          KES {loan.loanAmount?.toLocaleString() || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Service Fee:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          KES {loan.serviceFee?.toLocaleString() || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Amount to Receive:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          KES {(loan.loanAmount - loan.serviceFee)?.toLocaleString() || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Status:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'orange' }}>
                          Approving...
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Transaction Reference:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {loan.reference || 'N/A'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Application Date:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {loan.timestamp ? new Date(loan.timestamp).toLocaleString() : 'N/A'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              <Box sx={{ mt: 3, textAlign: 'center', width: '100%' }}>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, color: 'text.secondary', fontStyle: 'italic' }}
                >
                  Your application is being processed and will be approved within 24 hours. If rejected, your service fee will be automatically reversed.
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}
                >
                  Thank you for choosing Kopa Mobile to M-PESA!
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate('/')}
                  aria-label="Return to home page"
                >
                  Back to Home
                </Button>
              </Box>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}

export default LoanProgress;
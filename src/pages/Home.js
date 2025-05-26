import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Container,
  Grid,
  Link,
  IconButton,
  Modal,
  TextField,
  CircularProgress,
} from '@mui/material';
import { Phone, Email, Facebook, Twitter, Instagram } from '@mui/icons-material';
import { db, analytics, logEvent } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

function Home() {
  const navigate = useNavigate();
  const [openTrackModal, setOpenTrackModal] = useState(false);
  const [openErrorModal, setOpenErrorModal] = useState(false);
  const [trackForm, setTrackForm] = useState({ phoneNumber: '', nationalId: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleOpenTrackModal = () => {
    setOpenTrackModal(true);
    logEvent(analytics, 'track_loan_progress_open');
  };

  const handleCloseTrackModal = () => {
    setOpenTrackModal(false);
    setTrackForm({ phoneNumber: '', nationalId: '' });
    setErrors({});
  };

  const handleCloseErrorModal = () => {
    setOpenErrorModal(false);
    setTrackForm({ phoneNumber: '', nationalId: '' });
    setErrors({});
  };

  const handleTrackChange = (field) => (event) => {
    setTrackForm({ ...trackForm, [field]: event.target.value });
    setErrors({ ...errors, [field]: '' });
  };

  const validateTrackForm = () => {
    const newErrors = {};
    let formattedPhone = trackForm.phoneNumber;
    
    // Normalize phone number input
    if (!formattedPhone) {
      newErrors.phoneNumber = 'Please enter your phone number';
    } else {
      if (formattedPhone.startsWith('+254')) {
        formattedPhone = formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = `254${formattedPhone.slice(1)}`;
      }
      if (!/^(254[17]\d{8})$/.test(formattedPhone)) {
        newErrors.phoneNumber = 'Please enter a valid phone number (e.g., 07XXXXXXXX or +254XXXXXXXXX)';
      }
    }

    if (!trackForm.nationalId) {
      newErrors.nationalId = 'Please enter your National ID number';
    } else if (!/^\d{8,9}$/.test(trackForm.nationalId)) {
      newErrors.nationalId = 'National ID must be an 8 or 9-digit number';
    }

    setErrors(newErrors);
    Object.keys(newErrors).forEach((field) => {
      logEvent(analytics, 'track_loan_validation_error', {
        field,
        error: newErrors[field],
      });
    });
    return { isValid: Object.keys(newErrors).length === 0, formattedPhone };
  };

  const handleTrackSubmit = async () => {
    const { isValid, formattedPhone } = validateTrackForm();
    if (!isValid) return;
    setLoading(true);

    try {
      const loansRef = collection(db, 'loanTransactions'); // Updated to loanTransactions
      const q = query(
        loansRef,
        where('phoneNumber', '==', formattedPhone),
        where('nationalId', '==', trackForm.nationalId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        logEvent(analytics, 'track_loan_success', {
          phoneNumber: formattedPhone,
          nationalId: trackForm.nationalId,
        });
        navigate('/loan-progress', {
          state: { phoneNumber: formattedPhone, nationalId: trackForm.nationalId },
        });
      } else {
        logEvent(analytics, 'track_loan_not_found', {
          phoneNumber: formattedPhone,
          nationalId: trackForm.nationalId,
        });
        setOpenTrackModal(false);
        setOpenErrorModal(true);
      }
    } catch (error) {
      let errorMessage = 'An error occurred. Please try again.';
      if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please contact support.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Server is temporarily unavailable. Please try again later.';
      }
      setErrors({ submit: errorMessage });
      logEvent(analytics, 'track_loan_error', {
        error: error.message,
        code: error.code || 'unknown',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          minHeight: '70vh',
          width: '100%',
          backgroundImage: 'url(https://digitalbankingnews.co.ke/wp-content/uploads/2024/06/128698_web.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          '&:before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1,
          },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            py: { xs: 4, md: 8 },
          }}
        >
          <Typography
            variant="h1"
            gutterBottom
            sx={{
              color: 'white',
              fontWeight: 700,
              fontSize: { xs: '1.8rem', sm: '2.2rem', md: '3rem' },
            }}
          >
            Welcome to Kopa Mobile to
            <Typography
              component="span"
              variant="h1"
              sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '1.8rem', sm: '2.2rem', md: '3rem' },
              }}
            >
              {' '}
              M
              <Box
                component="img"
                src={require('../assets/logo.png')}
                alt="Kopa Mobile to M-PESA Logo"
                sx={{
                  height: 28,
                  width: 28,
                  verticalAlign: 'middle',
                  display: 'inline',
                }}
              />
              PESA
            </Typography>
          </Typography>
          <Typography
            variant="body1"
            gutterBottom
            sx={{
              color: 'white',
              fontSize: { xs: '1rem', md: '1.3rem' },
              mb: 4,
            }}
          >
            Access instant loans with seamless M-PESA integration. Start by checking your eligibility today!
          </Typography>
          <Typography
            variant="h3"
            gutterBottom
            sx={{
              color: 'accent.main', // #EF9651
              fontWeight: 700,
              fontSize: { xs: '1.5rem', md: '1.8rem' },
            }}
          >
            Get up to KES 30,000+ on your first application!
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/eligibility')}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 12,
                fontSize: { xs: '1rem', md: '1.2rem' },
              }}
            >
              Check Loan Eligibility
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleOpenTrackModal}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 12,
                fontSize: { xs: '1rem', md: '1.2rem' },
                color: 'white',
                borderColor: 'white',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              Track Loan Progress
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Track Loan Modal */}
      <Modal
        open={openTrackModal}
        onClose={handleCloseTrackModal}
        aria-labelledby="track-loan-modal-title"
        aria-describedby="track-loan-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography id="track-loan-modal-title" variant="h2" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            Track Your Loan Progress
          </Typography>
          <TextField
            fullWidth
            label="Phone Number (e.g., 07XXXXXXXX or +254XXXXXXXXX)"
            value={trackForm.phoneNumber}
            onChange={handleTrackChange('phoneNumber')}
            variant="outlined"
            required
            error={!!errors.phoneNumber}
            helperText={errors.phoneNumber}
            sx={{ mb: 2 }}
            inputProps={{ 'aria-invalid': !!errors.phoneNumber }}
            aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
          />
          <TextField
            fullWidth
            label="National ID Number"
            value={trackForm.nationalId}
            onChange={handleTrackChange('nationalId')}
            variant="outlined"
            required
            error={!!errors.nationalId}
            helperText={errors.nationalId}
            sx={{ mb: 2 }}
            inputProps={{ 'aria-invalid': !!errors.nationalId }}
            aria-describedby={errors.nationalId ? 'nationalId-error' : undefined}
          />
          {errors.submit && (
            <Typography color="error" sx={{ mb: 2, textAlign: 'center' }}>
              {errors.submit}
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleCloseTrackModal}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleTrackSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Track'}
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Error Modal */}
      <Modal
        open={openErrorModal}
        onClose={handleCloseErrorModal}
        aria-labelledby="error-modal-title"
        aria-describedby="error-modal-description"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', sm: 400 },
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography id="error-modal-title" variant="h2" sx={{ mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
            No Loan Found
          </Typography>
          <Typography id="error-modal-description" variant="body1" sx={{ mb: 3 }}>
            No loan application was found for the provided details. Please check your eligibility and apply for a loan first.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={handleCloseErrorModal}
            >
              Close
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate('/eligibility')}
            >
              Check Eligibility
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Services Section */}
      <Box id="services" sx={{ py: { xs: 4, md: 8 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            align="center"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
          >
            Our Services
          </Typography>
          <Grid container spacing={4}>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h3" sx={{ mb: 2, color: 'primary.main' }}>
                  Instant Loans
                </Typography>
                <Typography variant="body1">
                  Get quick access to funds directly to your M-PESA account with zero paperwork.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h3" sx={{ mb: 2, color: 'primary.main' }}>
                  Seamless M-PESA Integration
                </Typography>
                <Typography variant="body1">
                  Enjoy hassle-free loan disbursements and repayments via M-PESA.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h3" sx={{ mb: 2, color: 'primary.main' }}>
                  Easy Eligibility Check
                </Typography>
                <Typography variant="body1">
                  Verify your loan eligibility in minutes with our simple online process.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* About Section */}
      <Box id="about" sx={{ py: { xs: 4, md: 8 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h2"
            align="center"
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
          >
            About Us
          </Typography>
          <Typography
            variant="body1"
            align="center"
            sx={{ maxWidth: 800, mx: 'auto', fontSize: { xs: '1rem', md: '1.2rem' } }}
          >
            Kopa Mobile to M-PESA is dedicated to providing fast, secure, and convenient loan services to Kenyans. Our mission is to empower you with financial solutions that are accessible anytime, anywhere, through seamless M-PESA integration.
          </Typography>
        </Container>
      </Box>

      {/* Contact Section (Footer) */}
      <Box
        id="contact"
        component="footer"
        sx={{
          py: { xs: 4, md: 6 },
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="h3" sx={{ mb: 2 }}>
                Contact Us
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <Link href="mailto:support@kopa-to-mpesa.com" color="inherit">
                    support@kopa-to-mpesa.com
                  </Link>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Email sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <Link href="mailto:support@kopa-to-mpesa.com" color="inherit">
                    support@kopa-to-mpesa.com
                  </Link>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="h3" sx={{ mb: 2 }}>
                Follow Us
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <IconButton href="https://facebook.com" color="inherit">
                  <Facebook />
                </IconButton>
                <IconButton href="https://twitter.com" color="inherit">
                  <Twitter />
                </IconButton>
                <IconButton href="https://instagram.com" color="inherit">
                  <Instagram />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
          <Typography
            variant="body2"
            align="center"
            sx={{ mt: 4, fontSize: { xs: '0.9rem', md: '1rem' } }}
          >
            © {new Date().getFullYear()} Kopa Mobile to M-PESA. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default Home;
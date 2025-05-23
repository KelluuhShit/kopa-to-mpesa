import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  Box,
  CircularProgress,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { analytics, logEvent, db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format, subYears, isValid } from 'date-fns';

function Eligibility() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [fieldStatus, setFieldStatus] = useState({
    fullName: 'untouched',
    phoneNumber: 'untouched',
    nationalId: 'untouched',
    gender: 'untouched',
    dateOfBirth: 'untouched',
    county: 'untouched',
    education: 'untouched',
    employment: 'untouched',
    income: 'untouched',
    loanPurpose: 'untouched',
  });
  const [form, setForm] = useState({
    fullName: '',
    phoneNumber: '',
    nationalId: '',
    gender: '',
    dateOfBirth: null,
    county: '',
    education: '',
    employment: '',
    income: '',
    loanPurpose: '',
  });

  const steps = ['Personal Details', 'Additional Details'];

  const calculateLoanLimit = () => {
    return 27000; // Fixed limit as specified
  };

  const validateField = (field, value) => {
    let error = '';
    let isFieldValid = true;

    switch (field) {
      case 'fullName':
        if (!value.trim()) {
          error = 'Please enter your full name';
          isFieldValid = false;
        } else if (!/^[a-zA-Z\s]+$/.test(value.trim())) {
          error = 'Full Name should only contain letters and spaces';
          isFieldValid = false;
        }
        break;
      case 'phoneNumber':
        if (!value) {
          error = 'Please enter your phone number';
          isFieldValid = false;
        } else if (!/^(0[17]\d{8}|\+254[17]\d{8})$/.test(value)) {
          error = 'Please enter a valid phone number (e.g., 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX)';
          isFieldValid = false;
        }
        break;
      case 'nationalId':
        if (!value) {
          error = 'Please enter your National ID number';
          isFieldValid = false;
        } else if (!/^\d{8,}$/.test(value)) {
          error = 'National ID must be at least 8 digits';
          isFieldValid = false;
        }
        break;
      case 'gender':
        if (!value) {
          error = 'Please select your gender';
          isFieldValid = false;
        }
        break;
      case 'dateOfBirth':
        if (!value || !isValid(new Date(value))) {
          error = 'Please select a valid date of birth';
          isFieldValid = false;
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dob = new Date(value);
          dob.setHours(0, 0, 0, 0);
          const minAgeDate = subYears(today, 18);
          if (dob >= today) {
            error = 'Date of Birth must be before today';
            isFieldValid = false;
          } else if (dob > minAgeDate) {
            error = 'You must be at least 18 years old';
            isFieldValid = false;
          }
        }
        break;
      case 'county':
        if (!value.trim()) {
          error = 'Please enter your county of residence';
          isFieldValid = false;
        } else if (!/^[a-zA-Z\s]+$/.test(value.trim())) {
          error = 'County should only contain letters and spaces';
          isFieldValid = false;
        }
        break;
      case 'education':
        if (!value) {
          error = 'Please select your level of education';
          isFieldValid = false;
        }
        break;
      case 'employment':
        if (!value) {
          error = 'Please select your employment status';
          isFieldValid = false;
        }
        break;
      case 'income':
        if (!value) {
          error = 'Please select your monthly income range';
          isFieldValid = false;
        }
        break;
      case 'loanPurpose':
        if (!value) {
          error = 'Please select the loan purpose';
          isFieldValid = false;
        }
        break;
      default:
        break;
    }

    return { isValid: isFieldValid, error };
  };

  const validateStep1 = () => {
    const newErrors = {};
    const newFieldStatus = { ...fieldStatus };

    ['fullName', 'phoneNumber', 'nationalId', 'gender', 'dateOfBirth'].forEach((field) => {
      const { isValid, error } = validateField(field, form[field]);
      if (!isValid) {
        newErrors[field] = error;
        newFieldStatus[field] = 'invalid';
      } else {
        newFieldStatus[field] = 'valid';
      }
    });

    setErrors(newErrors);
    setFieldStatus(newFieldStatus);
    Object.keys(newErrors).forEach((field) => {
      logEvent(analytics, `eligibility_validation_error`, {
        step: 'step1',
        field,
        error: newErrors[field],
      });
    });
    console.log('validateStep1:', { errors: newErrors, isValid: Object.keys(newErrors).length === 0 });

    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    const newFieldStatus = { ...fieldStatus };

    ['county', 'education', 'employment', 'income', 'loanPurpose'].forEach((field) => {
      const { isValid, error } = validateField(field, form[field]);
      if (!isValid) {
        newErrors[field] = error;
        newFieldStatus[field] = 'invalid';
      } else {
        newFieldStatus[field] = 'valid';
      }
    });

    setErrors(newErrors);
    setFieldStatus(newFieldStatus);
    Object.keys(newErrors).forEach((field) => {
      logEvent(analytics, `eligibility_validation_error`, {
        step: 'step2',
        field,
        error: newErrors[field],
      });
    });
    console.log('validateStep2:', { errors: newErrors, isValid: Object.keys(newErrors).length === 0 });

    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (event) => {
    event.preventDefault();
    setHasInteracted(true);
    setErrors((prev) => ({ ...prev, submit: '' }));
    if (activeStep === 0) {
      const isValid = validateStep1();
      console.log('handleNext: Step 1 validation result:', isValid);
      if (isValid) {
        logEvent(analytics, 'eligibility_step_1_completed', {
          idNumber: form.nationalId,
        });
        setActiveStep(1);
      }
    } else if (activeStep === 1 && validateStep2()) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setErrors((prev) => ({ ...prev, submit: '' }));
    setSubmissionSuccess(false);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors((prev) => ({ ...prev, submit: '' }));
    try {
      const loanLimit = calculateLoanLimit();
      const formattedPhone = form.phoneNumber.startsWith('0')
        ? `254${form.phoneNumber.slice(1)}`
        : form.phoneNumber.replace('+254', '254');
      const submissionData = {
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber, // Store as entered
        nationalId: form.nationalId,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth ? format(new Date(form.dateOfBirth), 'yyyy-MM-dd') : null,
        county: form.county.trim(),
        education: form.education,
        employment: form.employment,
        income: form.income,
        loanPurpose: form.loanPurpose,
        eligible: true,
        limit: loanLimit,
        message: null,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'eligibilitySubmissions'), submissionData);
      logEvent(analytics, 'eligibility_submission_stored', {
        status: 'success',
        nationalId: form.nationalId,
        phoneNumber: formattedPhone, // Use normalized for analytics
        loanLimit,
      });

      setLoading(false);
      setSubmissionSuccess(true);
      logEvent(analytics, 'eligibility_check', {
        status: 'success',
        limit: loanLimit,
        phoneNumber: formattedPhone, // Use normalized for analytics
      });
      setTimeout(() => {
        navigate('/borrow', {
          state: {
            limit: loanLimit,
            nationalId: form.nationalId,
            fullName: form.fullName.trim(),
            phoneNumber: formattedPhone, // Pass normalized to Borrow.js
          },
        });
      }, 2000); // Delay navigation to show success message
    } catch (error) {
      setLoading(false);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) {
        switch (error.code) {
          case 'permission-denied':
            errorMessage = 'Permission denied. Please ensure you are authorized.';
            break;
          case 'unavailable':
            errorMessage = 'Firestore service unavailable. Please try again later.';
            break;
          case 'resource-exhausted':
            errorMessage = 'Quota exceeded. Please try again later.';
            break;
          default:
            errorMessage = `Firestore error: ${error.message}`;
        }
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      logEvent(analytics, 'eligibility_check_error', {
        error: error.message,
        type: error.code || (error.message.includes('network') ? 'network' : 'unknown'),
        phoneNumber: form.phoneNumber.startsWith('0')
          ? `254${form.phoneNumber.slice(1)}`
          : form.phoneNumber.replace('+254', '254'), // Normalize for analytics
        nationalId: form.nationalId,
      });
      setErrors({ submit: errorMessage });
    }
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setForm({ ...form, [field]: value });
    setFieldStatus({ ...fieldStatus, [field]: 'touched' });
    const { isValid, error } = validateField(field, value);
    setErrors({ ...errors, [field]: isValid ? '' : error });
    setFieldStatus({ ...fieldStatus, [field]: isValid ? 'valid' : 'invalid' });
  };

  const handleTextInput = (field) => (event) => {
    const value = event.target.value;
    if (/^[a-zA-Z\s]*$/.test(value)) {
      setForm({ ...form, [field]: value });
      setFieldStatus({ ...fieldStatus, [field]: 'touched' });
      const { isValid, error } = validateField(field, value);
      setErrors({ ...errors, [field]: isValid ? '' : error });
      setFieldStatus({ ...fieldStatus, [field]: isValid ? 'valid' : 'invalid' });
    }
  };

  const handleNumberInput = (field) => (event) => {
    const value = event.target.value.replace(/\D/g, '');
    setForm({ ...form, [field]: value });
    setFieldStatus({ ...fieldStatus, [field]: 'touched' });
    const { isValid, error } = validateField(field, value);
    setErrors({ ...errors, [field]: isValid ? '' : error });
    setFieldStatus({ ...fieldStatus, [field]: isValid ? 'valid' : 'invalid' });
  };

  const handleDateChange = (date) => {
    if (date && isValid(date)) {
      setFieldStatus({ ...fieldStatus, dateOfBirth: 'touched' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dob = new Date(date);
      dob.setHours(0, 0, 0, 0);
      const minAgeDate = subYears(today, 18);
      if (dob >= today) {
        setErrors({ ...errors, dateOfBirth: 'Date of Birth must be before today' });
        setFieldStatus({ ...fieldStatus, dateOfBirth: 'invalid' });
        logEvent(analytics, `eligibility_validation_error`, {
          step: 'step1',
          field: 'dateOfBirth',
          error: 'Date of Birth must be before today',
        });
      } else if (dob > minAgeDate) {
        setErrors({ ...errors, dateOfBirth: 'You must be at least 18 years old' });
        setFieldStatus({ ...fieldStatus, dateOfBirth: 'invalid' });
        logEvent(analytics, `eligibility_validation_error`, {
          step: 'step1',
          field: 'dateOfBirth',
          error: 'You must be at least 18 years old',
        });
      } else {
        setForm({ ...form, dateOfBirth: date });
        setErrors({ ...errors, dateOfBirth: '' });
        setFieldStatus({ ...fieldStatus, dateOfBirth: 'valid' });
      }
    } else {
      setForm({ ...form, dateOfBirth: null });
      setErrors({ ...errors, dateOfBirth: 'Please select a valid date' });
      setFieldStatus({ ...fieldStatus, dateOfBirth: 'invalid' });
      logEvent(analytics, `eligibility_validation_error`, {
        step: 'step1',
        field: 'dateOfBirth',
        error: 'Please select a valid date',
      });
    }
  };

  const hasStep1Errors = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = true;
    else if (!/^[a-zA-Z\s]+$/.test(form.fullName.trim())) errors.fullName = true;
    if (!form.phoneNumber) errors.phoneNumber = true;
    else if (!/^(0[17]\d{8}|\+254[17]\d{8})$/.test(form.phoneNumber)) errors.phoneNumber = true;
    if (!form.nationalId) errors.nationalId = true;
    else if (!/^\d{8,}$/.test(form.nationalId)) errors.nationalId = true;
    if (!form.gender) errors.gender = true;
    if (!form.dateOfBirth || !isValid(new Date(form.dateOfBirth))) errors.dateOfBirth = true;
    else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dob = new Date(form.dateOfBirth);
      dob.setHours(0, 0, 0, 0);
      const minAgeDate = subYears(today, 18);
      if (dob >= today || dob > minAgeDate) errors.dateOfBirth = true;
    }
    return Object.keys(errors).length > 0;
  };

  const hasStep2Errors = () => {
    const errors = {};
    if (!form.county.trim()) errors.county = true;
    else if (!/^[a-zA-Z\s]+$/.test(form.county.trim())) errors.county = true;
    if (!form.education) errors.education = true;
    if (!form.employment) errors.employment = true;
    if (!form.income) errors.income = true;
    if (!form.loanPurpose) errors.loanPurpose = true;
    return Object.keys(errors).length > 0;
  };

  const getInputAdornment = (field) => {
    if (fieldStatus[field] === 'valid') {
      return (
        <InputAdornment position="end">
          <CheckCircle sx={{ color: 'green' }} aria-label="Valid input" role="status" />
        </InputAdornment>
      );
    } else if (fieldStatus[field] === 'invalid') {
      return (
        <InputAdornment position="end">
          <Cancel sx={{ color: 'red' }} aria-label="Invalid input" role="status" />
        </InputAdornment>
      );
    }
    return null;
  };

  const maxDate = subYears(new Date(), 18);

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 2 }}>
      <CardContent>
        <Typography
          variant="h1"
          gutterBottom
          sx={{
            fontSize: { xs: '1.8rem', sm: '2.2rem', md: '3rem' },
            textAlign: 'center',
          }}
        >
          Check Your Eligibility
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {errors.submit && (
          <Typography
            variant="body1"
            color="error"
            sx={{ mb: 2, textAlign: 'center' }}
            role="alert"
          >
            {errors.submit}
          </Typography>
        )}
        {submissionSuccess && activeStep === steps.length - 1 && !loading && (
          <Typography
            variant="body1"
            sx={{ mb: 2, textAlign: 'center', color: 'success.main' }}
            role="alert"
          >
            Your eligibility check was successful! Please wait while we redirect you to the next step.
          </Typography>
        )}
        
        {activeStep === 0 && !submissionSuccess && (
          <Box component="form" noValidate>
            <TextField
              fullWidth
              label="Full Name"
              value={form.fullName}
              onChange={handleChange('fullName')}
              onInput={handleTextInput('fullName')}
              variant="outlined"
              required
              error={fieldStatus.fullName === 'invalid'}
              helperText={errors.fullName}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: getInputAdornment('fullName'),
              }}
              inputProps={{
                'aria-invalid': fieldStatus.fullName === 'invalid',
                'aria-describedby': errors.fullName ? 'fullName-error' : undefined,
              }}
            />
            <TextField
              fullWidth
              label="Phone Number (e.g., 07XXXXXXXX, 01XXXXXXXX, or +254XXXXXXXXX)"
              value={form.phoneNumber}
              onChange={handleChange('phoneNumber')}
              variant="outlined"
              required
              error={fieldStatus.phoneNumber === 'invalid'}
              helperText={errors.phoneNumber}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: getInputAdornment('phoneNumber'),
              }}
              inputProps={{
                'aria-invalid': fieldStatus.phoneNumber === 'invalid',
                'aria-describedby': errors.phoneNumber ? 'phoneNumber-error' : undefined,
              }}
            />
            <TextField
              fullWidth
              label="National ID Number (8 or more digits)"
              value={form.nationalId}
              onChange={handleNumberInput('nationalId')}
              variant="outlined"
              required
              error={fieldStatus.nationalId === 'invalid'}
              helperText={errors.nationalId}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: getInputAdornment('nationalId'),
              }}
              inputProps={{
                'aria-invalid': fieldStatus.nationalId === 'invalid',
                'aria-describedby': errors.nationalId ? 'nationalId-error' : undefined,
              }}
            />
            <FormControl
              fullWidth
              required
              sx={{ mb: 2 }}
              error={fieldStatus.gender === 'invalid'}
            >
              <InputLabel id="gender-label">Gender</InputLabel>
              <Select
                labelId="gender-label"
                value={form.gender}
                onChange={handleChange('gender')}
                label="Gender"
                SelectDisplayProps={{
                  'aria-invalid': fieldStatus.gender === 'invalid',
                  'aria-describedby': errors.gender ? 'gender-error' : undefined,
                }}
                endAdornment={getInputAdornment('gender')}
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
              {errors.gender && (
                <FormHelperText id="gender-error" error>
                  {errors.gender}
                </FormHelperText>
              )}
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date of Birth"
                value={form.dateOfBirth}
                onChange={handleDateChange}
                maxDate={maxDate}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    required
                    error={fieldStatus.dateOfBirth === 'invalid'}
                    helperText={errors.dateOfBirth}
                    sx={{ mb: 2 }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {getInputAdornment('dateOfBirth')}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    inputProps={{
                      ...params.inputProps,
                      'aria-invalid': fieldStatus.dateOfBirth === 'invalid',
                      'aria-describedby': errors.dateOfBirth ? 'dateOfBirth-error' : undefined,
                      readOnly: true,
                    }}
                  />
                )}
              />
            </LocalizationProvider>
          </Box>
        )}
        {activeStep === 1 && !submissionSuccess && (
          <Box component="form" noValidate>
            <TextField
              fullWidth
              label="County of Residence"
              value={form.county}
              onChange={handleChange('county')}
              onInput={handleTextInput('county')}
              variant="outlined"
              required
              error={fieldStatus.county === 'invalid'}
              helperText={errors.county}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: getInputAdornment('county'),
              }}
              inputProps={{
                'aria-invalid': fieldStatus.county === 'invalid',
                'aria-describedby': errors.county ? 'county-error' : undefined,
              }}
            />
            <FormControl
              fullWidth
              required
              sx={{ mb: 2 }}
              error={fieldStatus.education === 'invalid'}
            >
              <InputLabel id="education-label">Level of Education</InputLabel>
              <Select
                labelId="education-label"
                value={form.education}
                onChange={handleChange('education')}
                label="Level of Education"
                SelectDisplayProps={{
                  'aria-invalid': fieldStatus.education === 'invalid',
                  'aria-describedby': errors.education ? 'education-error' : undefined,
                }}
                endAdornment={getInputAdornment('education')}
              >
                <MenuItem value="Primary">Primary</MenuItem>
                <MenuItem value="Secondary">Secondary</MenuItem>
                <MenuItem value="Tertiary">Tertiary</MenuItem>
              </Select>
              {errors.education && (
                <FormHelperText id="education-error" error>
                  {errors.education}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl
              fullWidth
              required
              sx={{ mb: 2 }}
              error={fieldStatus.employment === 'invalid'}
            >
              <InputLabel id="employment-label">Employment Status</InputLabel>
              <Select
                labelId="employment-label"
                value={form.employment}
                onChange={handleChange('employment')}
                label="Employment Status"
                SelectDisplayProps={{
                  'aria-invalid': fieldStatus.employment === 'invalid',
                  'aria-describedby': errors.employment ? 'employment-error' : undefined,
                }}
                endAdornment={getInputAdornment('employment')}
              >
                <MenuItem value="Student">Student</MenuItem>
                <MenuItem value="Unemployed">Unemployed</MenuItem>
                <MenuItem value="Employed">Employed</MenuItem>
                <MenuItem value="Self-Employed">Self-Employed</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
              {errors.employment && (
                <FormHelperText id="employment-error" error>
                  {errors.employment}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl
              fullWidth
              required
              sx={{ mb: 2 }}
              error={fieldStatus.income === 'invalid'}
            >
              <InputLabel id="income-label">Monthly Income (KES)</InputLabel>
              <Select
                labelId="income-label"
                value={form.income}
                onChange={handleChange('income')}
                label="Monthly Income (KES)"
                SelectDisplayProps={{
                  'aria-invalid': fieldStatus.income === 'invalid',
                  'aria-describedby': errors.income ? 'income-error' : undefined,
                }}
                endAdornment={getInputAdornment('income')}
              >
                <MenuItem value="0-9999">0 - 9,999</MenuItem>
                <MenuItem value="10000-20000">10,000 - 20,000</MenuItem>
                <MenuItem value="20001-30000">20,001 - 30,000</MenuItem>
                <MenuItem value="30001-40000">30,001 - 40,000</MenuItem>
                <MenuItem value="40001-50000">40,001 - 50,000</MenuItem>
                <MenuItem value="50001-60000">50,001 - 60,000</MenuItem>
                <MenuItem value="60001-70000">60,001 - 70,000</MenuItem>
                <MenuItem value="70001-80000">70,001 - 80,000</MenuItem>
              </Select>
              {errors.income && (
                <FormHelperText id="income-error" error>
                  {errors.income}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl
              fullWidth
              required
              sx={{ mb: 2 }}
              error={fieldStatus.loanPurpose === 'invalid'}
            >
              <InputLabel id="loanPurpose-label">Loan Purpose</InputLabel>
              <Select
                labelId="loanPurpose-label"
                value={form.loanPurpose}
                onChange={handleChange('loanPurpose')}
                label="Loan Purpose"
                SelectDisplayProps={{
                  'aria-invalid': fieldStatus.loanPurpose === 'invalid',
                  'aria-describedby': errors.loanPurpose ? 'loanPurpose-error' : undefined,
                }}
                endAdornment={getInputAdornment('loanPurpose')}
              >
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Business">Business</MenuItem>
                <MenuItem value="Emergency">Emergency</MenuItem>
                <MenuItem value="Student">Student</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
              {errors.loanPurpose && (
                <FormHelperText id="loanPurpose-error" error>
                  {errors.loanPurpose}
                </FormHelperText>
              )}
            </FormControl>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleBack}
            disabled={activeStep === 0 || loading || submissionSuccess}
          >
            Back
          </Button>
          {!submissionSuccess && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
              disabled={loading || (activeStep === 0 && hasStep1Errors()) || (activeStep === 1 && hasStep2Errors())}
              sx={{ minWidth: 120 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : activeStep === steps.length - 1 ? (
                'Submit'
              ) : (
                'Next'
              )}
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default Eligibility;
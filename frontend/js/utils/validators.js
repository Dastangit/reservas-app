export const validateEmail = (email) => {
  const re = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

export const validatePassword = (password) => {
  return password && password.length >= 6;
};

export const validatePhone = (phone) => {
  const re = /^\+?[\d\s-]{10,}$/;
  return re.test(phone);
};

// Requiere código de país explícito (+53...). Más estricto que validatePhone,
// usado específicamente donde el número se usa para wa.me (necesita formato E.164).
export const validateInternationalPhone = (phone) => {
  const re = /^\+[1-9]\d{7,14}$/;
  return re.test(phone);
};

export const validateRequired = (value) => {
  return value && value.trim().length > 0;
};

export const validateDates = (checkIn, checkOut) => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return start < end;
};

export const validateGuests = (numGuests, maxGuests) => {
  return numGuests >= 1 && numGuests <= maxGuests;
};

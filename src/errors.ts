// success always 0
export const SUCCESS = 0

// transaction code
export const TRANSACTION_FAILED = 1
export const TRANSACTION_ERROR = 2

// general error code
export const DUPLICATED = 10003
export const BAD_REQUEST = 10400
export const UNAUTHORIZED = 10401
export const NOT_FOUND = 10404
export const INTERNAL_ERROR = 10500
export const SERVICE_UNAVAILABLE = 10503

// contract error code
export const CONTRACT_FAILED = 20001
export const CONTRACT_UNAUTHORIZED = 20401
export const CONTRACT_NOT_ENOUGH_PRICE = 20402
export const CONTRACT_NOT_INITIALIZED = 20403
export const CONTRACT_HAS_INITIALIZED = 20404

// database
export const DB_INSERT_FAILED = 30001
export const DB_ERROR = 30500

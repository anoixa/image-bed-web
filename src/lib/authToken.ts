interface AuthTokenState {
  accessToken: string | null;
  accessTokenExpiry: number | null;
}

let tokenState: AuthTokenState = {
  accessToken: null,
  accessTokenExpiry: null,
};

export function setAuthToken(accessToken: string, accessTokenExpiry: number) {
  tokenState = { accessToken, accessTokenExpiry };
}

export function clearAuthToken() {
  tokenState = { accessToken: null, accessTokenExpiry: null };
}

export function getAuthToken(): string | null {
  return tokenState.accessToken;
}

export function getAuthTokenExpiry(): number | null {
  return tokenState.accessTokenExpiry;
}


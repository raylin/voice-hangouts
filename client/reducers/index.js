const initialState = {
  user: {},
  clients: new Map(),
  messages: [],
};

let mid = 0;

function mergeClient(state = {
  uid: '',
  userName: undefined,
  peerConn: undefined,
  stream: undefined,
}, newState) {
  // Strip undefined properties
  Object.keys(newState).forEach((key) => !newState[key] && delete newState[key]);
  return { ...state, ...newState };
}

export default function (state = initialState, { type, payload }) {
  switch (type) {
    case 'SET_USER': {
      return { ...state, ...{ user: payload.user } };
    }
    case 'ADD_MESSAGE': {
      const { userName, message } = payload;
      mid += 1;
      return {
        ...state,
        messages: [...state.messages, {
          mid,
          userName,
          message,
        }],
      };
    }
    case 'SET_CLIENT': {
      const client = mergeClient(state.clients.get(payload.uid), payload);
      return { ...state, ...{ clients: new Map(state.clients.set(payload.uid, client)) } };
    }
    case 'DELETE_CLIENT': {
      state.clients.delete(payload.uid);
      return { ...state, ...{ clients: new Map(state.clients) } };
    }
    default: {
      return state;
    }
  }
}

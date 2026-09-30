export { DomError, DomErrorCode, isDomError } from './errors';
export type { DomErrorOptions } from './errors';

export { assertSerializable, findSerializableViolation, isSerializable } from './serializable';
export type { Serializable, SerializableViolation } from './serializable';

export { deserializeError, serializeError } from './wire-error';
export type { WireError } from './wire-error';

export { decodeMessage, encodeMessage, nativeEventName, POST_MESSAGE_GLOBAL, PROTOCOL_VERSION } from './protocol';
export type {
	ActionCallMessage,
	ConsoleMessage,
	DomToNativeMessage,
	HandleCallMessage,
	NativeToDomMessage,
	PropsMessage,
	ReadyMessage,
	ResizeMessage,
	ResultMessage,
	UncaughtErrorMessage,
} from './protocol';

export { PendingCalls } from './pending-calls';

export { splitProps } from './split-props';
export type { NativeAction, SplitProps } from './split-props';

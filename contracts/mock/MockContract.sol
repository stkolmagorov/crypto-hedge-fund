// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.15;

import "./IMockContract.sol";
/**
 * Implementation of the MockInterface.
 */
contract MockContract is IMockContract {
	enum MockType { Return, Revert, OutOfGas }

	bytes32 public constant MOCKS_LIST_START = hex"01";
	bytes public constant MOCKS_LIST_END = "0xff";
	bytes32 public constant MOCKS_LIST_END_HASH = keccak256(MOCKS_LIST_END);
	bytes4 public constant SENTINEL_ANY_MOCKS = hex"01";
	bytes public constant DEFAULT_FALLBACK_VALUE = abi.encode(false);

	// A linked list allows easy iteration and inclusion checks
	mapping(bytes32 => bytes) calldataMocks;
	mapping(bytes => MockType) calldataMockTypes;
	mapping(bytes => bytes) calldataExpectations;
	mapping(bytes => string) calldataRevertMessage;
	mapping(bytes32 => uint) calldataInvocations;

	mapping(bytes4 => bytes4) methodIdMocks;
	mapping(bytes4 => MockType) methodIdMockTypes;
	mapping(bytes4 => bytes) methodIdExpectations;
	mapping(bytes4 => string) methodIdRevertMessages;
	mapping(bytes32 => uint) methodIdInvocations;

	MockType fallbackMockType;
	bytes fallbackExpectation = DEFAULT_FALLBACK_VALUE;
	string fallbackRevertMessage;
	uint invocations;
	uint resetCount;

	constructor() {
		calldataMocks[MOCKS_LIST_START] = MOCKS_LIST_END;
		methodIdMocks[SENTINEL_ANY_MOCKS] = SENTINEL_ANY_MOCKS;
	}

	function trackCalldataMock(bytes memory call) private {
		bytes32 callHash = keccak256(call);
		if (calldataMocks[callHash].length == 0) {
			calldataMocks[callHash] = calldataMocks[MOCKS_LIST_START];
			calldataMocks[MOCKS_LIST_START] = call;
		}
	}

	function trackMethodIdMock(bytes4 methodId) private {
		if (methodIdMocks[methodId] == 0x0) {
			methodIdMocks[methodId] = methodIdMocks[SENTINEL_ANY_MOCKS];
			methodIdMocks[SENTINEL_ANY_MOCKS] = methodId;
		}
	}

	function _givenAnyReturn(bytes memory response) internal {
		fallbackMockType = MockType.Return;
		fallbackExpectation = response;
	}

	function givenAnyReturn(bytes calldata response) override external {
		_givenAnyReturn(response);
	}

	function givenAnyReturnBool(bool response) override external {
		uint flag = response ? 1 : 0;
		_givenAnyReturn(uintToBytes(flag));
	}

	function givenAnyReturnUint(uint response) override external {
		_givenAnyReturn(uintToBytes(response));
	}

	function givenAnyReturnAddress(address response) override external {
		_givenAnyReturn(uintToBytes(uint(uint160(response))));
	}

	function givenAnyRevert() override external {
		fallbackMockType = MockType.Revert;
		fallbackRevertMessage = "";
	}

	function givenAnyRevertWithMessage(string calldata message) override external {
		fallbackMockType = MockType.Revert;
		fallbackRevertMessage = message;
	}

	function givenAnyRunOutOfGas() override external {
		fallbackMockType = MockType.OutOfGas;
	}

	function _givenCalldataReturn(bytes memory call, bytes memory response) private  {
		calldataMockTypes[call] = MockType.Return;
		calldataExpectations[call] = response;
		trackCalldataMock(call);
	}

	function givenCalldataReturn(bytes calldata call, bytes calldata response) override external  {
		_givenCalldataReturn(call, response);
	}

	function givenCalldataReturnBool(bytes calldata call, bool response) override external {
		uint flag = response ? 1 : 0;
		_givenCalldataReturn(call, uintToBytes(flag));
	}

	function givenCalldataReturnUint(bytes calldata call, uint response) override external {
		_givenCalldataReturn(call, uintToBytes(response));
	}

	function givenCalldataReturnAddress(bytes calldata call, address response) override external {
		_givenCalldataReturn(call, uintToBytes(uint(uint160(response))));
	}

	function _givenMethodReturn(bytes memory call, bytes memory response) private {
		bytes4 method = bytesToBytes4(call);
		methodIdMockTypes[method] = MockType.Return;
		methodIdExpectations[method] = response;
		trackMethodIdMock(method);
	}

	function givenMethodReturn(bytes calldata call, bytes calldata response) override external {
		_givenMethodReturn(call, response);
	}

	function givenMethodReturnBool(bytes calldata call, bool response) override external {
		uint flag = response ? 1 : 0;
		_givenMethodReturn(call, uintToBytes(flag));
	}

	function givenMethodReturnUint(bytes calldata call, uint response) override external {
		_givenMethodReturn(call, uintToBytes(response));
	}

	function givenMethodReturnAddress(bytes calldata call, address response) override external {
		_givenMethodReturn(call, uintToBytes(uint(uint160(response))));
	}

	function givenCalldataRevert(bytes calldata call) override external {
		calldataMockTypes[call] = MockType.Revert;
		calldataRevertMessage[call] = "";
		trackCalldataMock(call);
	}

	function givenMethodRevert(bytes calldata call) override external {
		bytes4 method = bytesToBytes4(call);
		methodIdMockTypes[method] = MockType.Revert;
		trackMethodIdMock(method);
	}

	function givenCalldataRevertWithMessage(bytes calldata call, string calldata message) override external {
		calldataMockTypes[call] = MockType.Revert;
		calldataRevertMessage[call] = message;
		trackCalldataMock(call);
	}

	function givenMethodRevertWithMessage(bytes calldata call, string calldata message) override external {
		bytes4 method = bytesToBytes4(call);
		methodIdMockTypes[method] = MockType.Revert;
		methodIdRevertMessages[method] = message;
		trackMethodIdMock(method);
	}

	function givenCalldataRunOutOfGas(bytes calldata call) override external {
		calldataMockTypes[call] = MockType.OutOfGas;
		trackCalldataMock(call);
	}

	function givenMethodRunOutOfGas(bytes calldata call) override external {
		bytes4 method = bytesToBytes4(call);
		methodIdMockTypes[method] = MockType.OutOfGas;
		trackMethodIdMock(method);
	}

	function invocationCount() override external view returns (uint) {
		return invocations;
	}

	function invocationCountForMethod(bytes calldata call) override external view returns (uint) {
		bytes4 method = bytesToBytes4(call);
		return methodIdInvocations[keccak256(abi.encodePacked(resetCount, method))];
	}

	function invocationCountForCalldata(bytes calldata call) override external view returns (uint) {
		return calldataInvocations[keccak256(abi.encodePacked(resetCount, call))];
	}

	function reset() override external {
		// Reset all exact calldataMocks
		bytes memory nextMock = calldataMocks[MOCKS_LIST_START];
		bytes32 mockHash = keccak256(nextMock);
		// We cannot compary bytes
		while(mockHash != MOCKS_LIST_END_HASH) {
			// Reset all mock maps
			calldataMockTypes[nextMock] = MockType.Return;
			calldataExpectations[nextMock] = hex"";
			calldataRevertMessage[nextMock] = "";
			// Set next mock to remove
			nextMock = calldataMocks[mockHash];
			// Remove from linked list
			calldataMocks[mockHash] = "";
			// Update mock hash
			mockHash = keccak256(nextMock);
		}
		// Clear list
		calldataMocks[MOCKS_LIST_START] = MOCKS_LIST_END;

		// Reset all any calldataMocks
		bytes4 nextAnyMock = methodIdMocks[SENTINEL_ANY_MOCKS];
		while(nextAnyMock != SENTINEL_ANY_MOCKS) {
			bytes4 currentAnyMock = nextAnyMock;
			methodIdMockTypes[currentAnyMock] = MockType.Return;
			methodIdExpectations[currentAnyMock] = hex"";
			methodIdRevertMessages[currentAnyMock] = "";
			nextAnyMock = methodIdMocks[currentAnyMock];
			// Remove from linked list
			methodIdMocks[currentAnyMock] = 0x0;
		}
		// Clear list
		methodIdMocks[SENTINEL_ANY_MOCKS] = SENTINEL_ANY_MOCKS;

		fallbackExpectation = DEFAULT_FALLBACK_VALUE;
		fallbackMockType = MockType.Return;
		invocations = 0;
		resetCount += 1;
	}

	function useAllGas() private {
		while(true) {
			bool s;
			assembly {
				//expensive call to EC multiply contract
				s := call(sub(gas(), 2000), 6, 0, 0x0, 0xc0, 0x0, 0x60)
			}
		}
	}

	function bytesToBytes4(bytes memory b) private pure returns (bytes4) {
		bytes4 out;
		for (uint i = 0; i < 4; i++) {
			out |= bytes4(b[i] & 0xFF) >> (i * 8);
		}
		return out;
	}

	function uintToBytes(uint256 x) private pure returns (bytes memory b) {
		b = new bytes(32);
		assembly { mstore(add(b, 32), x) }
	}

	function updateInvocationCount(bytes4 methodId, bytes memory originalMsgData) public {
		require(msg.sender == address(this), "Can only be called from the contract itself");
		invocations += 1;
		methodIdInvocations[keccak256(abi.encodePacked(resetCount, methodId))] += 1;
		calldataInvocations[keccak256(abi.encodePacked(resetCount, originalMsgData))] += 1;
	}

	receive() payable external {
		fallbackImpl();
	}
	fallback() payable external {
		fallbackImpl();
	}

	function fallbackImpl() internal {
		bytes4 methodId = msg.sig;

		// First, check exact matching overrides
		if (calldataMockTypes[msg.data] == MockType.Revert) {
			revert(calldataRevertMessage[msg.data]);
		}
		if (calldataMockTypes[msg.data] == MockType.OutOfGas) {
			useAllGas();
		}
		bytes memory result = calldataExpectations[msg.data];

		// Then check method Id overrides
		if (result.length == 0) {
			if (methodIdMockTypes[methodId] == MockType.Revert) {
				revert(methodIdRevertMessages[methodId]);
			}
			if (methodIdMockTypes[methodId] == MockType.OutOfGas) {
				useAllGas();
			}
			result = methodIdExpectations[methodId];
		}

		// Last, use the fallback override
		if (result.length == 0) {
			if (fallbackMockType == MockType.Revert) {
				revert(fallbackRevertMessage);
			}
			if (fallbackMockType == MockType.OutOfGas) {
				useAllGas();
			}
			result = fallbackExpectation;
		}

		// Record invocation as separate call so we don't rollback in case we are called with STATICCALL
		(, bytes memory r) = address(this).call{gas: 100000}(abi.encodeWithSignature("updateInvocationCount(bytes4,bytes)", methodId, msg.data));
		assert(r.length == 0);

		assembly {
			return(add(0x20, result), mload(result))
		}
	}
}

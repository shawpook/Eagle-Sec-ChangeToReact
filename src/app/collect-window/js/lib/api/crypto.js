class EagleCrypto {
	generateUUID() {
		// NOTE: 另外如果網站不是 https，會不支援 crypto.randomUUID
		if (crypto && crypto.randomUUID) {
			return crypto.randomUUID();
		} else {
			return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
				var randomNumber = (Math.random() * 16) | 0,
					value = char == "x" ? randomNumber : (randomNumber & 0x3) | 0x8;
				return value.toString(16);
			});
		}
	}
}

eagle.crypto = new EagleCrypto();

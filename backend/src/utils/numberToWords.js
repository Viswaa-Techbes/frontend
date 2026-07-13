/**
 * Convert numbers to Indian currency word representation (Rupees and Paise)
 */
function toIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  
  const originalNum = num;
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  function convertInteger(amount) {
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scaleWords = ['', 'Thousand', 'Lakh', 'Crore'];

    if (amount === 0) return 'Zero';

    let word = '';
    let numberString = amount.toString();
    
    // Split into Indian numbering system format (e.g. 1,23,45,678)
    let chunks = [];
    if (numberString.length > 3) {
      // Last 3 digits (hundreds, tens, units)
      chunks.push(parseInt(numberString.slice(-3), 10));
      numberString = numberString.slice(0, -3);
      
      // Pairs of two digits
      while (numberString.length > 0) {
        if (numberString.length >= 2) {
          chunks.push(parseInt(numberString.slice(-2), 10));
          numberString = numberString.slice(0, -2);
        } else {
          chunks.push(parseInt(numberString, 10));
          numberString = '';
        }
      }
    } else {
      chunks.push(parseInt(numberString, 10));
    }

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      if (chunk === 0) continue;

      let chunkWord = '';
      
      // For hundreds, tens, units chunk
      if (i === 0) {
        let hundreds = Math.floor(chunk / 100);
        let remainder = chunk % 100;
        
        if (hundreds > 0) {
          chunkWord += singleDigits[hundreds] + ' Hundred ';
        }
        
        if (remainder > 0) {
          if (remainder < 10) {
            chunkWord += singleDigits[remainder];
          } else if (remainder < 20) {
            chunkWord += teenDigits[remainder - 10];
          } else {
            chunkWord += doubleDigits[Math.floor(remainder / 10)] + ' ' + singleDigits[remainder % 10];
          }
        }
      } else {
        // For other 2-digit chunks (Thousand, Lakh, Crore)
        if (chunk < 10) {
          chunkWord += singleDigits[chunk];
        } else if (chunk < 20) {
          chunkWord += teenDigits[chunk - 10];
        } else {
          chunkWord += doubleDigits[Math.floor(chunk / 10)] + ' ' + singleDigits[chunk % 10];
        }
      }

      if (chunkWord.trim() !== '') {
        word = chunkWord.trim() + ' ' + scaleWords[i] + ' ' + word;
      }
    }

    return word.trim();
  }

  let words = '';
  
  if (integerPart > 0) {
    words += convertInteger(integerPart) + ' Rupees';
  } else if (decimalPart === 0) {
    words += 'Zero Rupees';
  }

  if (decimalPart > 0) {
    if (integerPart > 0) {
      words += ' and ';
    }
    const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const doubleDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    let decimalWord = '';
    if (decimalPart < 10) {
      decimalWord = singleDigits[decimalPart];
    } else if (decimalPart < 20) {
      decimalWord = teenDigits[decimalPart - 10];
    } else {
      decimalWord = doubleDigits[Math.floor(decimalPart / 10)] + ' ' + singleDigits[decimalPart % 10];
    }
    
    words += decimalWord.trim() + ' Paise';
  }

  return words + ' Only';
}

module.exports = { toIndianWords };

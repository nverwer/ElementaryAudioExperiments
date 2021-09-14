/** em.js
 * This file contains utility functions for the Elementary Audio experiments.
 */


/**
 * Elementary nodes can handle up to 8 inputs. Sometimes this is not enough.
 * This function extends associative operators like `el.add` and `el.mul` to handle up to 64 inputs.
 */
exports.extend = (el_op) => {
  return (xs) => {
    // Partition xs in groups of 8 elements.
    const partitions = xs.reduce((partition, value, index) => {
        if (index % 8 == 0) {
          return partition.concat([[value]]);
        }else {
          partition[partition.length-1].push(value);
          return partition;
        }
      }, []);
    // Operate on each group, and then operate on the resulting outputs.
    return el_op(partitions.map(part => el_op(part)));
  }
};


/**
 * Generate a range of integers [0, n), i.e. 0 up to n-1.
 */
exports.range = (n) => Array.from({length: n}, (v,k) => k);


/**
 * The usual zipWith function. If more like this is needed, better use lodash.
 */
exports.zipWith = (f, ...arrays) => arrays[0].map((_, i) => f.apply(null, arrays.map(ar => ar[i])));

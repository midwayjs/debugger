export const xxx = async (name, age) => {
 return name + age;
}

export const testFunc = async (name, age) => {
  return {
    getResult: async (size) => {
      const result = await xxx(name, age);
      return result + ':' + size;
    }
  };
 }
import {test, expect } from '@playwright/test'; 


test('Locators', async({page}) => {
   
   await page.goto("https://docs.google.com/forms/d/e/1FAIpQLSc3yH3n0le4Np1SPFlMUGAkjfwVZb0NNFF8VpkSaT3dM520Sg/viewform?usp=publish-editor");






   // Wait for the form fields to appear
   await page.waitForSelector('input[type="text"]', { state: 'visible' });

   // Fill all short answer text fields (input[type="text"])



   const textInputs = page.locator('input[type="text"]');
   const textInputCount = await textInputs.count();

   /*  
     for (let i = 0; i < textInputCount; i++) {
       await textInputs.nth(i).fill(`Sample Answer ${i + 1}`);
   }
   */

   for (let i = 0; i < textInputCount; i++) {
       if(i === 0) {
        await textInputs.nth(0).fill(`raj`);
       } else if(i === 1) {
        await textInputs.nth(1).fill("24");
       } 
   }

   
   

   
   const textareas = page.locator('textarea');
   const textareaCount = await textareas.count();
   for (let i = 0; i < textareaCount; i++) {
       await textareas.nth(i).fill(`Sample Paragraph Answer ${i + 1}`);
   }


 
    await page.getByRole('radio', { name: 'Male', exact: true }).click()


   const submitButton = page.getByRole('button', { name: 'Submit' });
   await submitButton.click();



})


test('has title', async({page}) => {

    await page.goto("https://docs.google.com/forms/d/e/1FAIpQLSc3yH3n0le4Np1SPFlMUGAkjfwVZb0NNFF8VpkSaT3dM520Sg/viewform?usp=publish-editor");

    await expect(page).toHaveTitle(/Personal details/);
})